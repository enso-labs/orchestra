import os
import json
from datetime import datetime
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_core.documents import Document
from langchain.embeddings.base import init_embeddings
from langchain.embeddings.base import Embeddings
from fastapi import Request, UploadFile
from starlette.datastructures import UploadFile as StarletteUploadFile

from src.constants import DEFAULT_VECTOR_STORE_PATH
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

async def forward(request: Request, service_url: str = "http://localhost:8080", strip_prefix: str = "/api/rag/"):
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
            
            if request.headers.get("content-type", "").startswith("multipart/form-data"):
                form = await request.form()
                
                for key, value in form.items():
                    if isinstance(value, UploadFile) or isinstance(value, StarletteUploadFile):
                        # Read file content
                        try:
                            content = await value.read()
                            logger.debug(f"File content type: {type(content)}, size: {len(content)}")
                            
                            # Extract metadata from the file
                            file_metadata = extract_file_metadata(
                                filename=value.filename,
                                content=content,
                                content_type=value.content_type
                            )
                            extracted_metadatas.append(file_metadata)
                            logger.debug(f"Extracted metadata for {value.filename}: {file_metadata}")
                            
                            files_data[key] = (value.filename, content, value.content_type)
                            
                        except Exception as file_error:
                            logger.error(f"Error reading file {value.filename}: {file_error}")
                            raise file_error
                    else:
                        # Handle regular form fields
                        data_fields[key] = value
                
                # Add extracted metadata as JSON to the request
                if extracted_metadatas:
                    data_fields["metadatas_json"] = json.dumps(extracted_metadatas)
                    logger.debug(f"Adding metadatas_json to request: {data_fields['metadatas_json']}")

            # Build request with appropriate content
            if files_data or data_fields:
                proxy_resp = await client.request(
                    request.method,
                    full_url,
                    files=files_data if files_data else None,
                    data=data_fields if data_fields else None,
                    headers={k: v for k, v in request.headers.items() if k.lower() not in ["host", "content-length", "content-type"]}
                )
            else:
                body = await request.body()
                proxy_resp = await client.request(
                    request.method,
                    full_url,
                    content=body,
                    headers={k: v for k, v in request.headers.items() if k.lower() not in ["host", "content-length"]}
                )

            return proxy_resp
    except Exception as e:
        logger.exception(f"Error forwarding request: {e}")
        return httpx.Response(
            status_code=500,
            content=b'{"detail": "Internal server error"}',
            headers={"content-type": "application/json"}
        )

class VectorStore:
    def __init__(self, vector_store: InMemoryVectorStore = None):
        self.vector_store = vector_store if vector_store else get_vector_store()
        
    def load_vector_store(self, path: str = DEFAULT_VECTOR_STORE_PATH):
        try:
            if not os.path.exists(path):
                os.makedirs(path)
            store = self.vector_store.load(path, embedding=get_embedding_model())
            self.vector_store = store
        except Exception as e:
            print(f"Error loading vector store: {e}")
            raise e
        finally:
            return self.vector_store
        
    def add_docs(self, docs: list[Document]):
        try:
            self.load_vector_store()
            updated = self.vector_store.add_documents([Document(**doc) for doc in docs])
            self.vector_store.dump(DEFAULT_VECTOR_STORE_PATH)
            return updated
        except Exception as e:
            print(f"Error adding documents to vector store: {e}")
            return False
        
    async def aadd_docs(self, docs: list[Document]):
        await self.vector_store.aadd_documents(docs)
        return True
    
    def edit_doc(self, id: str, doc: Document):
        try:
            self.load_vector_store()
            found = self.vector_store.store.get(id)
            if found:
                # Update the document fields
                found['metadata'] = doc.metadata
                self.vector_store.store[id] = found
                self.vector_store.dump(DEFAULT_VECTOR_STORE_PATH)
                del found['vector']
                return found
        except Exception as e:
            print(f"Error editing document in vector store: {e}")
            return False
        
    def delete_docs(self, ids: list[str]):
        try:
            self.load_vector_store()
            self.vector_store.delete(ids)
            self.vector_store.dump(DEFAULT_VECTOR_STORE_PATH)
            return True
        except Exception as e:
            print(f"Error deleting documents from vector store: {e}")
            return False
    
    async def adelete_docs(self, ids: list[str]):
        await self.vector_store.adelete(ids)
        return True
    
    def query(self, query: str, k: int = 3):
        return self.vector_store.similarity_search(query, k)
    
    def query_with_score(self, query: str, k: int = 3):
        return self.vector_store.similarity_search_with_score(query, k)
    
    async def aquery(self, query: str, k: int = 3):
        return await self.vector_store.asimilarity_search(query, k)
    
    async def aquery_with_score(self, query: str, k: int = 3):
        return await self.vector_store.asimilarity_search_with_score(query, k)
    
    def retrieve(self, 
        query: str, 
        search_type: str = "mmr",  
        search_kwargs: dict = None,
    ):
        retriever = self.vector_store.as_retriever(
            search_type=search_type,
            search_kwargs=search_kwargs,
        )
        results = retriever.invoke(query)
        return results
    
    def list_docs(self):
        self.load_vector_store()
        docs = list(self.vector_store.store.values())
        for doc in docs:
            doc.pop('vector', None)
        return docs
    
    def find_docs_by_ids(self, ids: list[str]):
        self.load_vector_store()
        return self.vector_store.get_by_ids(ids)
    
    
    
## Retrieval Utils
def get_embedding_model(model_name: str = "openai:text-embedding-3-large"):
    provider, _ = model_name.split(":", maxsplit=1)
    return init_embeddings(model_name, api_key=get_api_key(provider))

def get_vector_store():
    embedding_model = get_embedding_model()
    return InMemoryVectorStore(embedding_model)