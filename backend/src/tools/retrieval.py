from datetime import timedelta
import httpx
from langchain_core.tools import tool, ToolException
from langchain_core.documents import Document

from src.routes.v0.auth import create_access_token
from src.schemas.models import User
from src.utils.retrieval import VectorStore
from src.constants import DEFAULT_VECTOR_STORE_PATH, LANGCONNECT_SERVER_URL
from src.utils.logger import logger


@tool
async def retrieval_query(query: str):
    """Craft a concise summary of current conversation if previous messages are provided, and a question as a query answered by relevant documents."""
    try:
        collection = retrieval_query.metadata["collection"]
        user_repo = retrieval_query.metadata["user_repo"]
        user: User = await user_repo.get_by_id()
        access_token = create_access_token(user, expires_delta=timedelta(days=1))
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{LANGCONNECT_SERVER_URL}/collections/{collection['id']}/documents/search",
                headers={"Authorization": f"Bearer {access_token}"},
                json={
                    "query": query,
                    "limit": collection["limit"],
                    "filter": collection["filter"],
                },
            )
            return response.json()
    except ToolException as e:
        logger.error(f"Error querying vector store: {e}")
        raise ToolException(f"Error querying vector store: {e}")
    except Exception as e:
        logger.error(f"Error querying vector store: {e}")
        raise ToolException(f"Error querying vector store: {e}")


@tool
def retrieval_add(docs: list[Document]):
    """Add documents to the vector store.

    Example:

        .. code-block:: python

            from langchain_core.documents import Document

            document = Document(
                page_content="Hello, world!",
                metadata={"source": "https://example.com"}
            )
    """
    return VectorStore().add_docs(docs)


@tool
def retrieval_load(path: str = DEFAULT_VECTOR_STORE_PATH):
    """Load the vector store from a file."""
    vector_store = VectorStore()
    return vector_store.load_vector_store(path)
