# PFG

Once you have downloaded all the files, you need to execute the docker-compose file, for that you can use this command:
```
docker-compose -f docker-compose.yml up --build
```
When the database API is started, you need to register the testuser, for that you can execute the corresponding python file with one of the following commands:
### For python3:
```
python3 .\UserRegistration.py
```
### For python:
```
python .\UserRegistration.py
```
### You might need to install requests, for that execute one of these commands:
### For python3:
```
pip3 install requests
```
### For python:
```
pip install requests
```
Once you have done this, you can access the page at:
<http://localhost:5173>
