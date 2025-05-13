FROM nvidia/cuda:12.2.0-base-ubuntu22.04

# Instalación de dependencias del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    libgl1-mesa-glx \
    libglib2.0-0 \
    build-essential \
    unzip \
    git \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Establece el directorio de trabajo
WORKDIR /app

# Copia los archivos del proyecto
COPY . /app

# Instala las dependencias de Python desde requirements.txt
RUN pip3 install --no-cache-dir -r requirements.txt

# Expone el puerto de la API Flask
EXPOSE 5000

# Comando para iniciar la aplicación
CMD ["python3", "yoloFSOD.py"]
