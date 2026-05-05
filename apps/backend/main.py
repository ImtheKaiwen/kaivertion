import os
import shutil
import uuid
from typing import Annotated, Optional, List
from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from tasks import process_file_task, celery_app

app = FastAPI(title="Kaivertion All-in-One")

# Storage & Static setup
STORAGE_DIR = os.getenv("STORAGE_DIR", "/app/storage")
STATIC_DIR = "/app/static"
os.makedirs(STORAGE_DIR, exist_ok=True)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 10 * 1024 * 1024

# --- PING ENDPOINT FOR UPTIME ROBOT ---
@app.get("/api/ping")
async def ping():
    return {"status": "alive", "timestamp": str(uuid.uuid4())}

@app.post("/api/upload")
async def upload_file(
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    operation: str = Form(...),
    width: Optional[int] = Form(None),
    height: Optional[int] = Form(None),
    password: Optional[str] = Form(None),
    text: Optional[str] = Form(None),
    pages: Optional[str] = Form(None)
):
    if file:
        file.file.seek(0, os.SEEK_END)
        if file.file.tell() > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large (Max 10MB)")
        file.file.seek(0)

    try:
        task_id = str(uuid.uuid4())
        task_dir = os.path.join(STORAGE_DIR, task_id)
        os.makedirs(task_dir, exist_ok=True)
        
        file_paths = []
        if file:
            f_path = os.path.join(task_dir, file.filename)
            with open(f_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            file_paths.append(f_path)
            
        if files:
            for f_upload in files:
                f_path = os.path.join(task_dir, f_upload.filename)
                with open(f_path, "wb") as buffer:
                    shutil.copyfileobj(f_upload.file, buffer)
                file_paths.append(f_path)

        kwargs = {
            "width": width, "height": height, "password": password, 
            "text": text, "pages": pages, "file_paths": file_paths
        }
        kwargs = {k: v for k, v in kwargs.items() if v is not None}
        
        primary_path = file_paths[0] if file_paths else None
        process_file_task.apply_async(
            args=[primary_path, task_id, operation], 
            kwargs=kwargs,
            task_id=task_id
        )
        return {"task_id": task_id, "status": "processing"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/status/{task_id}")
async def get_status(task_id: str):
    task_result = celery_app.AsyncResult(task_id)
    if task_result.state == "SUCCESS":
        return {"status": "SUCCESS", "result": task_result.result}
    elif task_result.state == "FAILURE":
        return {"status": "FAILURE", "error": str(task_result.info)}
    return {"status": task_result.state}

@app.get("/api/download/{task_id}/{filename}")
async def download_file(task_id: str, filename: str):
    file_path = os.path.join(STORAGE_DIR, task_id, filename)
    if os.path.exists(file_path):
        return FileResponse(path=file_path, filename=filename)
    raise HTTPException(status_code=404, detail="Not found")

# Serve Frontend
if os.path.exists(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
