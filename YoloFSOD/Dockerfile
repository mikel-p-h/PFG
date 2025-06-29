FROM nvidia/cuda:12.2.0-base-ubuntu22.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    libgl1-mesa-glx \
    libglib2.0-0 \
    build-essential \
    unzip \
    git \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . /app

RUN pip3 install --no-cache-dir -r requirements.txt

EXPOSE 5000

CMD ["python3", "yoloFSOD.py"]
