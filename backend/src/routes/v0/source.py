import tempfile
import os

from fastapi import File, UploadFile, status, Depends, APIRouter
from fastapi.responses import JSONResponse
from loguru import logger

from src.entities import AddDocuments
from src.loaders import Loader
from src.utils.auth import verify_credentials

TAG = "Retrieval"
router = APIRouter(tags=[TAG])

################################################################################
### Add Documents
################################################################################
@router.post(
    "/sources/upload",
    responses={
        status.HTTP_200_OK: {
            "description": "Upload files to output documents.",
            "content": {
                "application/json": {
                    "example": AddDocuments.model_json_schema()['example']
                }
            }
        }
    }
)
async def upload_sources_to_documents(
    files: list[UploadFile] = File(...),
    username: str = Depends(verify_credentials)
):
    logger.info(f"Processing {len(files)} uploaded files")
    
    documents = []
    with tempfile.TemporaryDirectory() as temp_dir:
        for file in files:
            file_content = await file.read()
            file_type = file.filename.split('.')[-1].lower()
            
            # Save file to temp directory
            temp_file_path = os.path.join(temp_dir, file.filename)
            with open(temp_file_path, 'wb') as f:
                f.write(file_content)
            
            loader_config = {
                'file_path': temp_file_path,
                'extract_images': True
            }
            
            try:
                loader = Loader.create(file_type, loader_config)
                docs = loader.load()
                documents.extend(docs)
            except Exception as e:
                logger.error(f"Error processing file {file.filename}: {str(e)}")
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"error": f"Failed to process file {file.filename}: {str(e)}"}
                )

    return JSONResponse(
        status_code=status.HTTP_200_OK, 
        content={"documents": [{k:v for k,v in doc.model_dump().items() if k != 'id'} for doc in documents]}
    )
        