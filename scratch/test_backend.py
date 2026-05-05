import requests
import os
import time

API_URL = "http://localhost:8000"

def test_tool(tool_id, file_path=None, params=None):
    print(f"\n--- Testing: {tool_id} ---")
    files = {}
    if file_path and os.path.exists(file_path):
        files = {'file': (os.path.basename(file_path), open(file_path, 'rb'))}
    
    data = {'operation': tool_id}
    if params:
        data.update(params)

    try:
        response = requests.post(f"{API_URL}/upload", files=files, data=data)
        if response.status_code != 200:
            print(f"UPLOAD FAILED: {response.status_code} - {response.text}")
            return
        
        task_id = response.json().get("task_id")
        print(f"Task ID: {task_id}")

        while True:
            status_res = requests.get(f"{API_URL}/status/{task_id}")
            status_data = status_res.json()
            status = status_data.get("status")
            
            if status == "SUCCESS":
                result = status_data.get('result')
                if result and 'error' in result:
                    print(f"TOOL FAILED: {result['error']}")
                else:
                    print(f"SUCCESS: {result}")
                break
            elif status == "FAILURE":
                print(f"TASK CRASHED: {status_data.get('error')}")
                break
            
            time.sleep(1)
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    pdf_path = "docker/test.pdf"
    img_path = "apps/frontend/src/assets/react.svg" # Vite default asset
    if not os.path.exists(img_path):
        # Fallback to any svg in public
        img_path = "apps/frontend/public/vite.svg"

    tests = [
        ("qr-generate", None, {"text": "Kaivertion Test"}),
        ("pdf-to-word", pdf_path, {}),
        ("pdf-to-text", pdf_path, {}),
        ("pdf-compress", pdf_path, {}),
        ("pdf-protect", pdf_path, {"password": "test"}),
        ("img-resize", img_path, {"width": 100, "height": 100}),
        ("img-to-webp", img_path, {}),
    ]

    for tool, path, params in tests:
        if path and not os.path.exists(path):
            print(f"Skipping {tool}, file not found: {path}")
            continue
        test_tool(tool, path, params)
