from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import pytesseract
import io
import re
import uvicorn

app = FastAPI(title="TollEase OCR Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

INDIAN_PLATE_PATTERN = re.compile(r'^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$')

def clean_plate_text(text: str) -> str:
    cleaned = re.sub(r'[^A-Z0-9]', '', text.upper())
    return cleaned

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ocr"}

@app.post("/ocr")
async def ocr_plate(file: UploadFile = File(...)):
    if not file.content_type.startswith('image/'):
        raise HTTPException(400, "File must be an image")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Preprocess: resize if too small, convert to grayscale
        if image.width < 300:
            scale = 300 / image.width
            image = image.resize((int(image.width * scale), int(image.height * scale)), Image.LANCZOS)
        
        image = image.convert('L')
        
        # OCR with Tesseract
        raw_text = pytesseract.image_to_string(image, config='--psm 8 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
        cleaned = clean_plate_text(raw_text)
        
        # Try to match Indian plate format
        match = INDIAN_PLATE_PATTERN.search(cleaned)
        plate = match.group(0) if match else cleaned[:10]
        
        confidence = 0.8 if match else 0.5
        
        return {
            "plate_number": plate,
            "raw_text": raw_text.strip(),
            "confidence": confidence,
            "matched": bool(match)
        }
    except Exception as e:
        raise HTTPException(500, f"OCR processing failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)