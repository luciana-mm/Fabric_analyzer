FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Instala dependências pesadas em camadas próprias antes do requirements.txt
# para maximizar o reaproveitamento de cache quando pacotes leves mudarem
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu "torch>=2.2.0" "torchvision>=0.17.0"
RUN pip install --no-cache-dir "opencv-python>=4.11.0" "numpy>=1.26.0"

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8090

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8090/health')" || exit 1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8090"]
