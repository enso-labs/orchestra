from fastapi.responses import JSONResponse
from fastapi import HTTPException, status, APIRouter, File, UploadFile, Form
from src.utils.logger import logger
from src.constants import GROQ_API_KEY
from groq import Groq

def audio_to_text(
    filename: str, 
    file_bytes: bytes, 
    model: str, 
    prompt: str, 
    response_format: str, 
    temperature: float, 
    timeout: float
):
    kwargs = {}
    if prompt is not None:
        kwargs["prompt"] = prompt
    if response_format is not None:
        kwargs["response_format"] = response_format
    if temperature is not None:
        kwargs["temperature"] = temperature
    if timeout is not None:
        kwargs["timeout"] = timeout
    client = Groq(api_key=GROQ_API_KEY)
    translation = client.audio.translations.create(
        file=(filename, file_bytes),
        model=model,
        **kwargs
    )
    return translation.text

router = APIRouter()

@router.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    model: str = Form("whisper-large-v3"),
    prompt: str = Form(None),
    response_format: str = Form(None),
    temperature: float = Form(None),
    timeout: float = Form(None)
):
    try:
        audio_bytes = await file.read()
        transcript = audio_to_text(
            file.filename, audio_bytes, model, prompt, response_format, temperature, timeout
        )
        return JSONResponse(
            content={"transcript": transcript},
            media_type="application/json",
            status_code=200
        )
    except Exception as e:
        logger.exception(str(e))
        raise HTTPException(status_code=500, detail=str(e))
