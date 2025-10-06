import os
import json
from datetime import datetime
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_core.documents import Document
from langchain.embeddings.base import init_embeddings
from langchain.embeddings.base import Embeddings
from fastapi import Request, UploadFile
from starlette.datastructures import UploadFile as StarletteUploadFile

from src.utils.logger import logger
import httpx

from src.utils.llm import get_api_key


def extract_file_metadata(filename: str, content: bytes, content_type: str) -> dict:
    """Extract metadata from file"""
    metadata = {
        "source": filename.strip(),
        "content_type": content_type,
        "file_size": len(content),
        "creationdate": datetime.now().isoformat(),
    }

    # Add file extension
    if filename and "." in filename:
        metadata["file_extension"] = filename.split(".")[-1].lower()

    # Add additional metadata based on file type
    if content_type:
        if content_type.startswith("image/"):
            metadata["file_category"] = "image"
        elif content_type.startswith("text/"):
            metadata["file_category"] = "text"
        elif content_type == "application/pdf":
            metadata["file_category"] = "document"
        elif content_type.startswith("video/"):
            metadata["file_category"] = "video"
        elif content_type.startswith("audio/"):
            metadata["file_category"] = "audio"
        else:
            metadata["file_category"] = "other"

    # You can add more sophisticated metadata extraction here
    # For example, for PDFs you could extract title, author, etc.
    # For images you could extract EXIF data, dimensions, etc.

    return metadata


async def langconnect_proxy(
    request: Request,
    service_url: str = "http://localhost:8080",
    strip_prefix: str = "/api/rag/",
):
    logger.info(f"Request: {request.__dict__}")
    try:
        stripped_path = request.url.path.replace(strip_prefix, "")

        # Get query parameters
        query_params = str(request.url.query) if request.url.query else ""
        full_url = f"{service_url}/{stripped_path}"
        if query_params:
            full_url += f"?{query_params}"

        async with httpx.AsyncClient() as client:
            # Handle form data and files
            files_data = {}
            data_fields = {}
            extracted_metadatas = []

            if request.headers.get("content-type", "").startswith(
                "multipart/form-data"
            ):
                form = await request.form()

                for key, value in form.items():
                    if isinstance(value, UploadFile) or isinstance(
                        value, StarletteUploadFile
                    ):
                        # Read file content
                        try:
                            content = await value.read()
                            logger.debug(
                                f"File content type: {type(content)}, size: {len(content)}"
                            )

                            # Extract metadata from the file
                            file_metadata = extract_file_metadata(
                                filename=value.filename,
                                content=content,
                                content_type=value.content_type,
                            )
                            extracted_metadatas.append(file_metadata)
                            logger.debug(
                                f"Extracted metadata for {value.filename}: {file_metadata}"
                            )

                            files_data[key] = (
                                value.filename,
                                content,
                                value.content_type,
                            )

                        except Exception as file_error:
                            logger.error(
                                f"Error reading file {value.filename}: {file_error}"
                            )
                            raise file_error
                    else:
                        # Handle regular form fields
                        data_fields[key] = value

                # Add extracted metadata as JSON to the request
                if extracted_metadatas:
                    data_fields["metadatas_json"] = json.dumps(extracted_metadatas)
                    logger.debug(
                        f"Adding metadatas_json to request: {data_fields['metadatas_json']}"
                    )

            # Build request with appropriate content
            if files_data or data_fields:
                proxy_resp = await client.request(
                    request.method,
                    full_url,
                    files=files_data if files_data else None,
                    data=data_fields if data_fields else None,
                    headers={
                        k: v
                        for k, v in request.headers.items()
                        if k.lower() not in ["host", "content-length", "content-type"]
                    },
                )
            else:
                body = await request.body()
                proxy_resp = await client.request(
                    request.method,
                    full_url,
                    content=body,
                    headers={
                        k: v
                        for k, v in request.headers.items()
                        if k.lower() not in ["host", "content-length"]
                    },
                )

            return proxy_resp
    except Exception as e:
        logger.exception(f"Error forwarding request: {e}")
        return httpx.Response(
            status_code=500,
            content=b'{"detail": "Internal server error"}',
            headers={"content-type": "application/json"},
        )


## Retrieval Utils
def get_embedding_model(model_name: str = "openai:text-embedding-3-large"):
    provider, _ = model_name.split(":", maxsplit=1)
    return init_embeddings(model_name, api_key=get_api_key(provider))


def get_vector_store():
    embedding_model = get_embedding_model()
    return InMemoryVectorStore(embedding_model)
