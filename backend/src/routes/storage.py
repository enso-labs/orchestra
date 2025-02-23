from typing import List, File
from fastapi import APIRouter, File, Depends
from services.storage import StorageService

router = APIRouter()

@router.post("/upload-with-urls")
async def upload_files_with_urls(
    files: List[UploadFile] = File(...),
    bucket: str = "your-bucket-name",
    include_presigned: bool = False,
    storage_service: StorageService = Depends(get_storage_service)
):
    """
    Upload multiple files and return their info, optionally with presigned URLs
    """
    try:
        results = storage_service.upload_and_get_presigned_urls(
            files=files,
            bucket=bucket,
            prefix="user-uploads",
            expiration=3600,
            include_presigned=include_presigned
        )
        return {
            "status": "success",
            "files": results
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        } 