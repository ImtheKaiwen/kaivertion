# All-in-One Converter (2026 Edition)

A minimalist, privacy-focused, high-speed file conversion tool.

## Features
- **PDF Operations:** Word ↔ PDF, Merge, Split, Protect, Unlock, PDF to Image.
- **Image Operations:** PNG ↔ JPEG ↔ WebP ↔ HEIC, Resize, Compress, Background Remover.
- **Bonus:** Excel ↔ PDF, SVG to PNG, Raw Text to PDF.
- **Privacy:** Files are processed in-memory or /tmp and deleted immediately.
- **UI:** Apple-esque, drag-and-drop focused, premium aesthetics.

## Tech Stack
- **Frontend:** React + Vite + Framer Motion
- **Backend:** FastAPI + Celery + Redis
- **Engines:** Stirling-PDF, Pillow
- **Containerization:** Docker Compose

## Quick Start
1. Clone the repository.
2. Setup environment: `cp .env.example .env`
3. Start the services:
   ```bash
   cd docker
   docker-compose up --build
   ```

## Development
### Frontend
```bash
cd apps/frontend
npm install
npm run dev
```

### Backend
```bash
cd apps/backend
pip install -r requirements.txt
python main.py
```
