from typing import Annotated


from fastapi import Body, HTTPException, status, Depends, APIRouter
from fastapi.responses import JSONResponse
from loguru import logger

from src.constants.examples import LIST_DOCUMENTS_EXAMPLE
from src.entities import AddDocuments, DocIds, Document
from src.utils.auth import verify_credentials
from src.utils.retrieval import VectorStore

TAG = "Retrieval"
router = APIRouter(tags=[TAG])

################################################################################
### Add Documents
################################################################################
@router.post(
    "/documents", 
    responses={
        status.HTTP_200_OK: {
            "description": "Add documents to the vector store.",
            "content": {
                "application/json": {
                    "example": DocIds.model_json_schema()['example']
                }
            }
        }
    }
)
def add_documents(
    body: Annotated[AddDocuments, Body()],
    username: str = Depends(verify_credentials)
):
    logger.info(f"Adding documents to the vector store: {body.documents}")
    created = VectorStore().add_docs(body.documents)
    if created:
        return JSONResponse(status_code=status.HTTP_200_OK, content={"documents": created})
    else:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST, 
            content={"error": "Failed to add documents to the vector store"}
        )
        
        
    
################################################################################
### List Documents
################################################################################
@router.get(
    "/documents", 
    responses={
        status.HTTP_200_OK: {
            "description": "List all documents in the vector store.",
            "content": {
                "application/json": {
                    "example": LIST_DOCUMENTS_EXAMPLE
                }
            }
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "Failed to delete documents from the vector store."
        }
    }
)
def list_documents(
    username: str = Depends(verify_credentials)
):
    vectorstore = VectorStore()
    return JSONResponse(status_code=status.HTTP_200_OK, content={"documents": vectorstore.list_docs()}) 


################################################################################
### Add Documents
################################################################################
@router.put(
    "/documents/{id}", 
    responses={
        status.HTTP_200_OK: {
            "description": "Update a document in the vector store.",
            "content": {
                "application/json": {
                    "example": LIST_DOCUMENTS_EXAMPLE['documents'][0]
                }
            }
        }
    }
)
def update_document(
    id: str,
    body: Annotated[Document, Body()],
    username: str = Depends(verify_credentials)
):
    logger.info(f"Updating document in the vector store: {body}")
    updated = VectorStore().edit_doc(id, body)
    if updated:
        return JSONResponse(status_code=status.HTTP_200_OK, content={"documents": updated})
    else:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST, 
            content={"error": "Failed to add documents to the vector store"}
        )

################################################################################
### Find Documents
################################################################################
@router.get(
    "/documents/{id}", 
    responses={
        status.HTTP_200_OK: {
            "description": "Find document by id.",
            "content": {
                "application/json": {
                    "example": {
                        "document": LIST_DOCUMENTS_EXAMPLE['documents'][0]
                    }
                }
            }
        }
    }
)
def find_document(
    id: str,
    username: str = Depends(verify_credentials)
):
    vectorstore = VectorStore()
    doc = vectorstore.find_docs_by_ids([id])[0]
    return JSONResponse(status_code=status.HTTP_200_OK, content={"document": doc.model_dump()}) 
    
################################################################################
### Delete Documents
################################################################################
@router.delete(
    "/documents", 
    responses={
        status.HTTP_204_NO_CONTENT: {
            "description": "Delete documents from the vector store.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "Failed to delete documents from the vector store."
        }
    }
)
def delete_documents(
    body: Annotated[DocIds, Body()],
    username: str = Depends(verify_credentials)
):
    logger.info(f"Deleting documents from the vector store: {body.documents}")
    deleted = VectorStore().delete_docs(body.documents)
    if deleted:
        return HTTPException(status_code=status.HTTP_204_NO_CONTENT)
    else:
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Failed to delete documents from the vector store"
        )
