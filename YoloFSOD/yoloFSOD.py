from flask import Flask, request, jsonify
import os, tempfile, shutil, zipfile, json, yaml
from pathlib import Path
from ultralytics import YOLO

app = Flask(__name__)

def read_predictions_from_txt(pred_dir, img_dir):
    result_data = []

    for txt_file in Path(pred_dir).rglob("*.txt"):
        img_name = txt_file.stem  # nombre del archivo sin extensión
        corresponding_image = next(Path(img_dir).rglob(f"{img_name}.*"), None)

        if corresponding_image:
            # Cargamos tamaño de la imagen para normalizar
            labels = []
            with open(txt_file, 'r') as f:
                for line in f:
                    parts = line.strip().split()
                    class_id, x_center, y_center, width, height = map(float, parts)
                    labels.append([int(class_id), x_center, y_center, width, height])

            result_data.append({'image': corresponding_image.name, 'labels': labels})

    return result_data

@app.route('/fsod-train', methods=['POST'])
def fsod_train():
    temp_dir = tempfile.mkdtemp()

    try:
        if 'dataset' not in request.files:
            return jsonify({'error': 'Dataset ZIP is required'}), 400

        dataset_zip = request.files['dataset']
        model_name = request.form.get('model', 'yolo12m.pt')
        zip_path = os.path.join(temp_dir, 'dataset.zip')
        dataset_zip.save(zip_path)

        dataset_dir = os.path.join(temp_dir, 'dataset')
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(dataset_dir)

        yaml_path = os.path.join(dataset_dir, 'data.yaml')
        if not os.path.exists(yaml_path):
            return jsonify({'error': 'data.yaml not found'}), 400

        with open(yaml_path) as f:
            yaml_data = yaml.safe_load(f)

        # Actualizamos las rutas a images/train y images/val
        yaml_data['path'] = dataset_dir
        for key in ['train', 'val']:
            if key in yaml_data:
                yaml_data[key] = os.path.join(dataset_dir, 'images', key).replace("\\", "/")
        
        with open(yaml_path, 'w') as f:
            yaml.dump(yaml_data, f)

        model = YOLO(model_name)

        # Entrenamiento usando solo train y val
        model.train(
            data=yaml_path,
            epochs=int(request.form.get('epochs', 10)),
            imgsz=int(request.form.get('imgsz', 640)),
            batch=int(request.form.get('batch', 4)),
            lr0=float(request.form.get('lr', 0.001)),
            freeze=5,
            verbose=False
        )

        # Predicciones en carpeta predict
        predict_images_path = os.path.join(dataset_dir, 'images', 'predict')
        if not os.path.exists(predict_images_path):
            return jsonify({'error': 'predict folder not found in dataset'}), 400

        # Crear una carpeta de resultados
        predict_save_dir = os.path.join(temp_dir, 'predict_results')

        model.predict(
            source=predict_images_path,
            save=True,
            save_txt=True,
            project=predict_save_dir,
            name='preds',
            imgsz=int(request.form.get('imgsz', 640)),
            conf=0.4,
            verbose=False
        )

        preds_folder = os.path.join(predict_save_dir, 'preds', 'labels')

        predictions = read_predictions_from_txt(preds_folder, predict_images_path)

        return jsonify({'status': 'success', 'predictions': predictions})

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)