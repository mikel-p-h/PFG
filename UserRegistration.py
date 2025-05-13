import requests

# URL del endpoint
url = "http://localhost:8000/register"

# Datos del formulario
data = {
    "email": "testuser@example.com",
    "password": "password"
}

# Hacemos la petición POST
response = requests.post(url, data=data)

# Mostramos la respuesta
print("Status code:", response.status_code)
print("Response JSON:", response.json())
