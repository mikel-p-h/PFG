from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException, Query, Path, Body
from typing import List, Optional
import os
import uuid
from uuid import UUID
from PIL import Image
from sqlalchemy.orm import Session
from database import engine, Base, get_db
import models
from models import ImageEntry
import json
import bcrypt
import zipfile
import io
import base64
import requests
import shutil
import tempfile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.model_selection import train_test_split
import yaml
from fastapi.responses import StreamingResponse
import cv2

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

class RenameProjectRequest(BaseModel):
    name: str

class AnnotationUpdate(BaseModel):
    annotations: List[str]
    finished: bool = False

@app.post("/upload")
async def upload_project(
    project_name: str = Form(...),
    project_owner: str = Form(...),
    labels: List[str] = Form(...),
    colors: List[str] = Form(...),
    folder: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == project_owner).first()

    project_id = uuid.uuid4()
    project = models.Project(
        id=project_id,
        name=project_name,
        status="Not Started",
        owner=project_owner,
        labels=json.dumps(labels),
        colors=json.dumps(colors)
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    if user.projects:
        project_list = json.loads(user.projects)
        project_list.append(str(project_id))
    else:
        project_list = [str(project_id)]

    user.projects = json.dumps(project_list)
    db.commit()

    zip_data = await folder.read()
    temp_path = f"temp/{project_id}"
    os.makedirs(temp_path, exist_ok=True)

    with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zip_ref:
        zip_ref.extractall(temp_path)

    frame_counter = 1
    for root, _, files in os.walk(temp_path):
        for file in sorted(files):
            file_path = os.path.join(root, file)
            file_ext = file.lower().split('.')[-1]

            if file_ext in ["jpg", "png"]:
                # Procesar imagen
                img = Image.open(file_path)
                width, height = img.size
                extension = os.path.splitext(file)[1].lower()
                unique_name = f"frame_{frame_counter:06d}{extension}"

                with open(file_path, "rb") as image_file:
                    img_bytes = image_file.read()

                yolo_data = None
                txt_file = os.path.splitext(file_path)[0] + ".txt"
                if os.path.exists(txt_file):
                    with open(txt_file, "r") as f:
                        yolo_data = f.read()

                db.add(models.ImageEntry(
                    project_id=project.id,
                    image_name=unique_name,
                    image=img_bytes,
                    yolo=yolo_data if yolo_data else None,
                    frame_number=frame_counter
                ))
                print(f"Guardando imagen: {unique_name}, con anotaciones: {yolo_data if yolo_data else 'Sin anotaciones'}")
                frame_counter += 1

            elif file_ext in ["mp4", "avi", "mov", "mkv"]:
                # Procesar video
                cap = cv2.VideoCapture(file_path)
                fps = cap.get(cv2.CAP_PROP_FPS)
                if not fps or fps <= 0:
                    fps = 30  # fallback
                frame_interval = int(fps / 10) if fps >= 10 else 1

                frame_idx = 0
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    if frame_idx % frame_interval == 0:
                        _, buffer = cv2.imencode('.jpg', frame)
                        img_bytes = buffer.tobytes()
                        unique_name = f"frame_{frame_counter:06d}.jpg"

                        db.add(models.ImageEntry(
                            project_id=project.id,
                            image_name=unique_name,
                            image=img_bytes,
                            yolo=None,
                            frame_number=frame_counter
                        ))
                        print(f"Guardando frame extraído: {unique_name}")
                        frame_counter += 1
                    frame_idx += 1
                cap.release()

    db.commit()
    return {"message": "Project uploaded and processed successfully", "project_id": str(project.id)}

@app.delete("/project/{project_id}")
def delete_project(project_id: UUID, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db.query(models.ImageEntry).filter(models.ImageEntry.project_id == project_id).delete()
    db.delete(project)
    db.commit()
    
    return {"message": "Project and associated images deleted successfully"}

@app.put("/project/{project_id}/labels")
async def update_labels_form(
    project_id: UUID,
    labels: List[str] = Form(...),
    colors: List[str] = Form(...),
    db: Session = Depends(get_db)
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.labels = json.dumps(labels)
    project.colors = json.dumps(colors)
    db.commit()

    return {"message": "Project labels and colors updated successfully"}

@app.post("/register")
def register_user(
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Registra un nuevo usuario en la base de datos.
    Se guarda el email y el hash de la contraseña (con bcrypt).
    """
    user_exists = db.query(models.User).filter(models.User.email == email).first()
    if user_exists:
        raise HTTPException(status_code=400, detail="The email is already registered")
    
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
    
    new_user = models.User(
        email=email,
        password=password_hash.decode(),
        projects=json.dumps([])
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"message": "User registered correctly", "email": email}

@app.get("/projects")
def get_projects_by_email(
    email: str,
    states: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Devuelve los proyectos asociados a un usuario dado su correo, con la opción de filtrar por estado.
    """
    user = db.query(models.User).filter(models.User.email == email).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    project_ids = json.loads(user.projects)
    project_ids = [UUID(project_id) for project_id in project_ids]
    query = db.query(models.Project).filter(models.Project.id.in_(project_ids))
    
    if states:
        valid_states = ["Finished", "In Progress", "Not Started"]
        invalid_states = [state for state in states if state not in valid_states]
        
        if invalid_states:
            raise HTTPException(status_code=400, detail=f"Invalid states: {', '.join(invalid_states)}")
        
        query = query.filter(models.Project.status.in_(states))
    
    projects = query.all()
    
    if not projects:
        raise HTTPException(status_code=404, detail="No projects found for this user")
    
    project_data = []
    for project in projects:
        project_data.append({
            "project_id": str(project.id),
            "name": project.name,
            "status": project.status,
            "owner": project.owner,
            "labels": json.loads(project.labels),
            "colors": json.loads(project.colors)
        })
    
    return {"projects": project_data}


@app.get("/project/{project_id}")
def get_project_name(
    project_id: UUID = Path(..., description="ID del proyecto"),
    db: Session = Depends(get_db)
):
    """
    Devuelve el nombre de un proyecto dado su ID.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"project_id": str(project.id), "name": project.name}


@app.put("/project/{project_id}/rename")
def rename_project(
    project_id: UUID = Path(..., description="ID del proyecto"),
    body: RenameProjectRequest = Body(...),
    db: Session = Depends(get_db)
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project.name = body.name
    db.commit()
    db.refresh(project)

    return {"message": "Project name updated successfully", "project_id": str(project.id), "new_name": project.name}


@app.get("/project/{project_id}/images")
def get_images_by_project(
    project_id: UUID,
    finished: bool = None,
    synthetic: bool = None,
    skip: int = 0,
    limit: int = 6,
    db: Session = Depends(get_db)
):
    """
    Devuelve las imágenes y anotaciones de un proyecto dado su ID, con soporte para paginación y filtrado por 'finished' y 'synthetic'.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    query = db.query(models.ImageEntry).filter(models.ImageEntry.project_id == project_id)
    
    if finished is not None:
        query = query.filter(models.ImageEntry.finished == finished)
    
    if synthetic is not None:
        query = query.filter(models.ImageEntry.synthetic == synthetic)

    images = query.offset(skip).limit(limit).all()
    
    if not images:
        raise HTTPException(status_code=404, detail="No images found for this project")

    image_data = []
    for image in images:
        encoded_image = base64.b64encode(image.image).decode('utf-8')
        yolo_data = image.yolo.splitlines() if image.yolo else []
        image_data.append({
            "image_name": image.image_name,
            "yolo": yolo_data,
            "id": image.id,
            "synthetic": image.synthetic,
            "finished": image.finished,
            "frame_number": image.frame_number,
            "image": encoded_image
        })

    return {"images": image_data}

@app.put("/update_annotations/{image_id}")
async def update_annotations(
    image_id: int,
    payload: AnnotationUpdate,
    db: Session = Depends(get_db)
):
    image_entry = db.query(models.ImageEntry).filter(models.ImageEntry.id == image_id).first()
    if not image_entry:
        raise HTTPException(status_code=404, detail="Image not found")

    cleaned_annotations = [a.strip() for a in payload.annotations if a.strip() != ""]

    if not cleaned_annotations:
        image_entry.yolo = None
    else:
        image_entry.yolo = "\n".join(cleaned_annotations)

    image_entry.finished = payload.finished
    db.commit()

    return {"message": "Annotations updated successfully"}

@app.post("/synthetic")
async def upload_synthetic_image(
    project_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    image_count = db.query(models.ImageEntry).filter(models.ImageEntry.project_id == project_id).count()
    frame_counter = image_count + 1

    extension = os.path.splitext(file.filename)[1].lower()
    unique_name = f"frame_{frame_counter:06d}{extension}"

    img_bytes = await file.read()
    try:
        Image.open(io.BytesIO(img_bytes))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    db.add(models.ImageEntry(
        project_id=project.id,
        image_name=unique_name,
        image=img_bytes,
        synthetic=True,
        finished=False,
        frame_number=frame_counter
    ))
    db.commit()

    return {"message": "Synthetic image uploaded successfully", "image_name": unique_name}

@app.post("/share_project")
def share_project(
    project_id: UUID = Form(...),
    owner_email: str = Form(...),
    recipient_email: str = Form(...),
    db: Session = Depends(get_db)
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project or project.owner != owner_email:
        raise HTTPException(status_code=403, detail="Project does not belong to the specified owner")

    recipient = db.query(models.User).filter(models.User.email == recipient_email).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient user not found")

    recipient_projects = json.loads(recipient.projects) if recipient.projects else []
    if str(project_id) not in recipient_projects:
        recipient_projects.append(str(project_id))
        recipient.projects = json.dumps(recipient_projects)
        db.commit()
        return {"message": f"Project {project_id} shared with {recipient_email}"}
    else:
        return {"message": f"User {recipient_email} already has access to project {project_id}"}

@app.get("/project/{project_id}/labels")
def get_project_labels(project_id: UUID, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        label_names = json.loads(project.labels)
        label_colors = json.loads(project.colors)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error parsing project labels or colors")

    if len(label_names) != len(label_colors):
        raise HTTPException(status_code=500, detail="Label names and colors mismatch")

    return [
        { "name": name, "color": color }
        for name, color in zip(label_names, label_colors)
    ]

@app.get("/project/{project_id}/image/{frame_number}")
def get_image_annotations_by_frame(
    project_id: UUID,
    frame_number: int,
    db: Session = Depends(get_db)
):
    image = db.query(models.ImageEntry).filter(
        models.ImageEntry.frame_number == frame_number,
        models.ImageEntry.project_id == project_id
    ).first()

    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    _, ext = os.path.splitext(image.image_name)
    image_format = ext[1:].lower()

    return {
        "image_id": image.id,
        "image_name": image.image_name,
        "yolo": image.yolo,
        "finished": image.finished,
        "labels": json.loads(project.labels),
        "colors": json.loads(project.colors),
        "image": base64.b64encode(image.image).decode("utf-8"),
        "format": image_format
    }

@app.get("/project/{project_id}/image_count")
def get_image_count_by_project(
    project_id: UUID,
    db: Session = Depends(get_db)
):
    images = db.query(models.ImageEntry).filter(models.ImageEntry.project_id == project_id)
    count = images.count()

    first_image = images.order_by(models.ImageEntry.id.asc()).first()
    first_image_id = first_image.id if first_image else None

    return {
        "project_id": str(project_id),
        "total_images": count,
        "first_image_id": first_image_id
    }

@app.post("/project/{project_id}/generate-dataset")
def generate_dataset(project_id: UUID, db: Session = Depends(get_db)):
    temp_dir = tempfile.mkdtemp()

    try:
        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        images_dir = os.path.join(temp_dir, 'images')
        labels_dir = os.path.join(temp_dir, 'labels')
        for split in ['train', 'val', 'predict']:
            os.makedirs(os.path.join(images_dir, split), exist_ok=True)
            os.makedirs(os.path.join(labels_dir, split), exist_ok=True)

        images_finished = db.query(models.ImageEntry).filter(
            models.ImageEntry.project_id == project_id,
            models.ImageEntry.finished == True
        ).all()

        if len(images_finished) < 5:
            raise HTTPException(status_code=400, detail=f"Not enough finished images, just ({len(images_finished)} provided)")

        images_unfinished = db.query(models.ImageEntry).filter(
            models.ImageEntry.project_id == project_id,
            models.ImageEntry.finished == False
        ).all()

        train_imgs, val_imgs = train_test_split(images_finished, test_size=0.15, random_state=42)

        def save_images_and_labels(entries, split):
            for entry in entries:
                image_filename = entry.image_name
                image_extension = os.path.splitext(image_filename)[1]
                image_output_path = os.path.join(images_dir, split, image_filename)
                with open(image_output_path, 'wb') as img_file:
                    img_file.write(entry.image)

                if split in ['train', 'val'] and entry.yolo:
                    labels = entry.yolo  # List of strings with label information
                    label_filename = image_filename.replace(image_extension, '.txt')
                    label_output_path = os.path.join(labels_dir, split, label_filename)

                    with open(label_output_path, 'w') as label_file:
                        label_file.write(f"{labels}\n")
                        print(f"Guardando etiqueta: {labels} en {label_output_path}")
                        print(f"Label file saved: {label_file}")

        labels_list = json.loads(project.labels)
        real_labels = json.loads(labels_list[0])

        save_images_and_labels(train_imgs, 'train')
        save_images_and_labels(val_imgs, 'val')
        save_images_and_labels(images_unfinished, 'predict')

        data_yaml = {
            'path': './',
            'train': 'images/train',
            'predict': 'images/predict',
            'val': 'images/val',
            'nc': len(real_labels),
            'names': real_labels
        }

        with open(os.path.join(temp_dir, 'data.yaml'), 'w') as f:
            yaml.dump(data_yaml, f, sort_keys=False)

        zip_buffer = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
        with zipfile.ZipFile(zip_buffer.name, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for foldername, _, filenames in os.walk(temp_dir):
                for filename in filenames:
                    filepath = os.path.join(foldername, filename)
                    arcname = os.path.relpath(filepath, temp_dir)
                    zipf.write(filepath, arcname)

        with open(zip_buffer.name, 'rb') as f:
            files = {'dataset': f}
            data = {
                'model': 'yolo12m.pt',
                'epochs': '40',
                'imgsz': '640',
                'batch': '8',
                'lr': '0.001'
            }
            response = requests.post('http://yolo:5001/fsod-train', files=files, data=data)
            fsod_response = response.json()

            saved_labels_info = []

            if "predictions" in fsod_response:
                for prediction in fsod_response["predictions"]:
                    image_name = prediction["image"]
                    labels = prediction["labels"]

                    label_lines = []
                    for label in labels:
                        label_line = " ".join(str(x) for x in label)
                        label_lines.append(label_line)

                    yolo_text = "\n".join(label_lines)

                    image_entry = db.query(models.ImageEntry).filter(
                        models.ImageEntry.project_id == project_id,
                        models.ImageEntry.image_name == image_name
                    ).first()

                    if image_entry:
                        image_entry.yolo = yolo_text

                db.commit()

            return "Dataset labeled successfully"

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

@app.get("/download/{project_id}")
def download_project_data(
    project_id: UUID,
    include_images: bool = Query(True, description="Incluir imágenes en el zip"),
    db: Session = Depends(get_db)
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    images = db.query(models.ImageEntry).filter(models.ImageEntry.project_id == project_id).all()
    if not images:
        raise HTTPException(status_code=404, detail="No images found for this project")

    # Deserializar correctamente las etiquetas
    try:
        labels_list = json.loads(project.labels)
        real_labels = json.loads(labels_list[0])
    except (json.JSONDecodeError, IndexError, TypeError):
        raise HTTPException(status_code=500, detail="Invalid labels format in project")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        # Escribir anotaciones y (opcionalmente) imágenes
        for image_entry in images:
            base_filename = os.path.splitext(image_entry.image_name)[0]

            # Guardar anotación en labels/
            annotation_filename = f"labels/{base_filename}.txt"
            yolo_data = image_entry.yolo or ""
            zip_file.writestr(annotation_filename, yolo_data)

            # Guardar imagen en images/
            if include_images:
                image_filename = f"images/{image_entry.image_name}"
                zip_file.writestr(image_filename, image_entry.image)

        # Añadir archivo data.yaml
        yaml_content = "#*Edit the paths with your own and delete this line*#\n"
        yaml_content += "path: ./\n\n"
        yaml_content += "train: images/?\n"
        yaml_content += "test: images/?\n"
        yaml_content += "val: images/?\n\n"
        yaml_content += f"nc: {len(real_labels)}\n\n"
        yaml_content += "names:\n"
        for label in real_labels:
            yaml_content += f"- {label}\n"

        zip_file.writestr("data.yaml", yaml_content)

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/x-zip-compressed",
        headers={"Content-Disposition": f"attachment; filename=project_{project_id}.zip"}
    )
