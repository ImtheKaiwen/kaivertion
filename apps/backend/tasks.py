import os
import time
import shutil
import subprocess
from celery import Celery
from PIL import Image

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
STORAGE_DIR = os.getenv("STORAGE_DIR", "/app/storage")

celery_app = Celery("tasks", broker=REDIS_URL, backend=REDIS_URL)

@celery_app.task(name="process_file_task")
def process_file_task(file_path: str, task_id: str, operation: str, **kwargs):
    print(f"--- LOCAL ALCHEMY: {operation} ---")
    try:
        if not file_path and operation != "qr-generate":
            return {"error": "Missing source file"}

        # --- IMAGE OPS ---
        if operation.startswith("img-"):
            from PIL import Image as PILImage
            img = PILImage.open(file_path)
            target_ext = ".png"
            if "to-jpg" in operation: target_ext = ".jpg"
            elif "to-webp" in operation: target_ext = ".webp"
            elif "to-pdf" in operation: target_ext = ".pdf"
            out_name = f"result_{task_id}{target_ext}"
            out_path = os.path.join(STORAGE_DIR, task_id, out_name)
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            if "resize" in operation or operation == "img-resize":
                w, h = int(kwargs.get("width", 800)), int(kwargs.get("height", 600))
                img = img.resize((w, h), PILImage.Resampling.LANCZOS)
            if "remove-bg" in operation:
                from rembg import remove
                with open(file_path, "rb") as i:
                    out_data = remove(i.read())
                with open(out_path, "wb") as o:
                    o.write(out_data)
            else:
                if target_ext in [".jpg", ".pdf"] and img.mode in ("RGBA", "P"): img = img.convert("RGB")
                img.save(out_path)
            return {"download_url": f"/download/{task_id}/{out_name}"}

        # --- PDF OPS ---
        elif operation == "pdf-to-word":
            from pdf2docx import Converter
            out_name = f"result_{task_id}.docx"
            out_path = os.path.join(STORAGE_DIR, task_id, out_name)
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            cv = Converter(file_path)
            cv.convert(out_path)
            cv.close()
            return {"download_url": f"/download/{task_id}/{out_name}"}

        elif operation == "pdf-to-excel":
            out_dir = os.path.join(STORAGE_DIR, task_id)
            os.makedirs(out_dir, exist_ok=True)
            subprocess.run(["soffice", "--headless", "--convert-to", "xlsx", "--outdir", out_dir, file_path], check=True)
            out_name = os.path.splitext(os.path.basename(file_path))[0] + ".xlsx"
            return {"download_url": f"/download/{task_id}/{out_name}"}

        elif operation == "pdf-protect":
            from pypdf import PdfReader, PdfWriter
            out_name = f"protected_{task_id}.pdf"
            out_path = os.path.join(STORAGE_DIR, task_id, out_name)
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            reader, writer = PdfReader(file_path), PdfWriter()
            for page in reader.pages: writer.add_page(page)
            writer.encrypt(kwargs.get("password", "1234"))
            with open(out_path, "wb") as f: writer.write(f)
            return {"download_url": f"/download/{task_id}/{out_name}"}

        elif operation == "pdf-to-text":
            out_name = f"text_{task_id}.txt"
            out_path = os.path.join(STORAGE_DIR, task_id, out_name)
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            subprocess.run(["pdftotext", file_path, out_path], check=True)
            return {"download_url": f"/download/{task_id}/{out_name}"}

        # --- OFFICE OPS ---
        elif operation.endswith("-to-pdf"):
            out_dir = os.path.join(STORAGE_DIR, task_id)
            os.makedirs(out_dir, exist_ok=True)
            subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", out_dir, file_path], check=True)
            out_name = os.path.splitext(os.path.basename(file_path))[0] + ".pdf"
            return {"download_url": f"/download/{task_id}/{out_name}"}

        # --- UTILS ---
        elif operation == "qr-generate":
            import qrcode
            out_name = f"qr_{task_id}.png"
            out_path = os.path.join(STORAGE_DIR, task_id, out_name)
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            qrcode.make(kwargs.get("text", "Kaivertion")).save(out_path)
            return {"download_url": f"/download/{task_id}/{out_name}"}

        elif operation == "svg-to-png":
            from cairosvg import svg2png
            out_name = f"svg_{task_id}.png"
            out_path = os.path.join(STORAGE_DIR, task_id, out_name)
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            svg2png(url=file_path, write_to=out_path)
            return {"download_url": f"/download/{task_id}/{out_name}"}

        return {"error": "Not implemented locally"}
    except Exception as e:
        return {"error": str(e)}
