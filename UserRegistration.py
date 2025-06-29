import requests

url = "http://localhost:8000/register"

data = {
    "email": "testuser@example.com",
    "password": "password"
}

response = requests.post(url, data=data)

print("Status code:", response.status_code)
print("Response JSON:", response.json())
