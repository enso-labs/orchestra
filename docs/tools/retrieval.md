# Retrieval Tools

The following tools provide functionality to interact with vector stores for retrieval-based operations.

## retrieval_query

A tool that allows querying the vector store to retrieve relevant documents based on semantic similarity.

### Description
This tool performs similarity or MMR (Maximum Marginal Relevance) search on the vector store to find documents relevant to a query.

### Parameters
- `query`: A string representing the search query.
- `search_type`: The type of search to perform. Options:
  - `"similarity"`: (Default) Standard similarity search
  - `"mmr"`: Maximum Marginal Relevance search, which optimizes for relevance and diversity
- `search_kwargs`: A dictionary containing additional search parameters.
  - Default: `{"k": 10}` - Returns the top 10 most similar documents

### Returns
The most relevant documents from the vector store.

### Example Usage
```python
from langchain_core.tools import tool
from src.utils.retrieval import VectorStore

@tool
def retrieval_query(query: str, search_type: str = "similarity", search_kwargs: dict = {"k": 10}):
    """Query the vector store. Search type can be 'mmr' or 'similarity'. Search kwargs is a dictionary of kwargs for the search type."""
    loaded_vector_store = VectorStore().load_vector_store()
    vector_store = VectorStore(loaded_vector_store)
    return vector_store.retrieve(query, search_type, search_kwargs)
```

## retrieval_add

A tool for adding new documents to the vector store.

### Description
This tool allows you to add new documents to the existing vector store, making them available for future retrieval queries.

### Parameters
- `docs`: A list of `Document` objects to add to the vector store.

### Returns
Confirmation of documents being added to the vector store.

### Example Usage
```python
from langchain_core.tools import tool
from langchain_core.documents import Document

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
```

## retrieval_load

A tool for loading a vector store from a specified path.

### Description
This tool loads a vector store from a file. If no path is provided, it uses the default vector store path defined in the constants.

### Parameters
- `path`: (Optional) A string representing the path to the vector store file. 
  - Default: Uses the `DEFAULT_VECTOR_STORE_PATH` from constants.

### Returns
The loaded vector store instance.

### Example Usage
```python
from langchain_core.tools import tool
from src.constants import DEFAULT_VECTOR_STORE_PATH

@tool
def retrieval_load(path: str = DEFAULT_VECTOR_STORE_PATH):
    """Load the vector store from a file."""
    vector_store = VectorStore()
    return vector_store.load_vector_store(path)
```