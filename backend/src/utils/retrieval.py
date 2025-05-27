import os
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_core.documents import Document
from langchain.embeddings.base import init_embeddings
from langchain.embeddings.base import Embeddings
from fastapi import Request, UploadFile

from src.services.db import ASYNC_DB_URI
from src.constants import DEFAULT_VECTOR_STORE_PATH
from src.utils.logger import logger
import httpx

from src.utils.llm import get_api_key

async def forward(request: Request, service_url: str = "http://localhost:8080", strip_prefix: str = "/api/rag/"):
    logger.info(f"Request: {request.__dict__}")
    try:
        stripped_path = request.url.path.replace(strip_prefix, "")
        async with httpx.AsyncClient() as client:
            # Handle form data and files
            form_data = None
            if request.headers.get("content-type", "").startswith("multipart/form-data"):
                form = await request.form()
                form_data = {}
                for key, value in form.items():
                    if isinstance(value, UploadFile):
                        # Read file content and reset file pointer
                        content = await value.read()
                        await value.seek(0)  # Reset file pointer after reading
                        form_data[key] = (value.filename, content, value.content_type)
                    else:
                        form_data[key] = value

            # Build request with appropriate content
            if form_data:
                proxy_req = client.build_request(
                    request.method,
                    f"{service_url}/{stripped_path}",
                    files=form_data,
                    headers={k: v for k, v in request.headers.items() if k.lower() != "host"}
                )
            else:
                proxy_req = client.build_request(
                    request.method,
                    f"{service_url}/{stripped_path}",
                    content=await request.body(),
                    headers={k: v for k, v in request.headers.items() if k.lower() != "host"}
                )

            proxy_resp = await client.send(proxy_req)
            return proxy_resp
    except Exception as e:
        logger.error(f"Error forwarding request: {e}")
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