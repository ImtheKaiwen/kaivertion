# Consolidated Dockerfile for Render.com (Single Service)
FROM python:3.10-slim-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y \
    redis-server supervisor nginx libreoffice poppler-utils \
    libgl1-mesa-glx libglib2.0-0 curl gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

WORKDIR /app

# 1. Build Frontend
COPY apps/frontend ./apps/frontend
WORKDIR /app/apps/frontend
RUN npm install && npm run build

# 2. Setup Backend
WORKDIR /app
COPY apps/backend ./apps/backend
WORKDIR /app/apps/backend
COPY docker/backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn uvicorn supervisor redis celery rembg pdf2docx pypdf qrcode cairosvg

# 3. Finalize
WORKDIR /app
RUN mkdir -p /app/storage /app/logs /app/static
RUN cp -r /app/apps/frontend/dist/* /app/static/
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

ENV STORAGE_DIR=/app/storage
ENV REDIS_URL=redis://localhost:6379/0
ENV PYTHONPATH=/app/apps/backend

EXPOSE 10000

# Run supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
