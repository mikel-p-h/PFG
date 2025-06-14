# Final Degree Project
Once you have downloaded all the files, you need to execute the docker-compose file, for that you can use this command:
```
docker-compose -f docker-compose.yml up --build
```
or if you are using a newer version of docker compose you might have to use this other command:
```
docker compose -f docker-compose.yml up --build
```
> [!CAUTION]
> It is very important that you have nvidia-container-toolkit installed on your computer so that docker have access to your GPU, if you do not have it the program will not work.

<br></br>
> [!IMPORTANT] 
> When the database API is started, you need to register the testuser, for that you can execute the corresponding python file with one of the following commands:
> ### For python3:
> ```
> python3 .\UserRegistration.py
> ```
> ### For python:
> ```
> python .\UserRegistration.py
> ```

<br></br>
> [!NOTE] 
> You might need to install requests, for that execute one of these commands:
> ### For python3:
> ```
> pip3 install requests
> ```
> ### For python:
> ```
> pip install requests
> ```

<br></br>
> [!TIP]
> Once you have done this, you can access the page at:
<http://localhost:5173>

<br></br>
# APP Guide
## Projects

This is the Projects page, here you can see al the projects that you have access to (the projects you have created or that someone have shared with you*). 

![My Projects Interface](https://github.com/user-attachments/assets/a2014830-40fd-4bb8-9416-701bfc3d6f2e)

## New Project
If you click on the "New Project" button on the "Projects" interface, you will access this interface where you can create a new project, for that you have to fill all fields with an "*" on them, this are all except for the annotations one, which is not necesary, but in case you want to add already created annotations you must add them in yolo format (in the future more formats might be accepted).
When you add images/videos or/and annotations they will appear in the search box below, there you can search for everything you have added and delete something in case you added it by mistake.

![New Project Interface](https://github.com/user-attachments/assets/efc4638a-1d85-4528-9621-58c03d435168)

## Project Details
Once you have your project/s created, you can open one by clicking on it and you will access this new view with a gallery with the images, information of the project like the labels and their colors, and a button to download all the created annotations with or without the images. There is also a "Share" button with which you can share the project with other people*.
![Project Details Interface](https://github.com/user-attachments/assets/c883eebc-b5c3-4454-a438-c210e5f0e152)

## Annotations
If you double click an image of the gallery you will access this page where you can create annotations for the different images or edit the already created ones. Some functionalities like the "Undo" or "Redo" are not available yet. 
To facilitate user experience the page shows the "Save" and "Frame Finished" buttons in a green color when everything done on that frame is saved or the frame is marked as finished, if you edit something this color will disappear so that you know that you have to save it.
At the top right part of the interface you will see two different buttons, the first one is to change the interface to the inpainting mode, while the second button, the one that says "Start" is to start the automatic annotation (to start it you need to finish annotating at least 5 images).
![Annotations Interface](https://github.com/user-attachments/assets/6b057bf1-b629-43ab-8fb9-54517c71253e)

## Inpainting
As mentioned before, this is the inpainting mode that you access when clicking the button with a pencil (the first button on the top right part of the annotations interface).
On this mode you can draw a mask in the image and add a prompt in the text box that you find in the bottom part of the interface, once you have the mask and the prompt you have to click on the "Start" button to start generating the modifications you ask for, this modifications will be applied on the part of the image that is covered by the mask you draw.
![Inpainting Interface](https://github.com/user-attachments/assets/321b3f18-2d85-4170-8f54-c2d63762536b)

### Inpainting Result
When the model finishes generating the modifications to the image, this popup will appear, where you need to choose whether you want to save or delete the image generated.
![Inpainting Interface 2](https://github.com/user-attachments/assets/eab2512e-5312-499f-9765-7c8d84810965)

> [!NOTE]
> This project is not completely developed, there are many things that I want to change but due to the time limit of the final degree project those changes will be applied in a future.

**Multi user functionality is not complete yet*
