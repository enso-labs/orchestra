from typing import Literal

from langchain_community.document_loaders import (
    CSVLoader,
    GitbookLoader,
    PyPDFLoader,
    TextLoader,
    JSONLoader,
    RecursiveUrlLoader,
    ReadTheDocsLoader,
    DataFrameLoader,
    WebBaseLoader,
    YoutubeLoader,
    SitemapLoader,
    BlockchainDocumentLoader,
)
from langchain_core.document_loaders import BaseLoader

from .basic import Base64Loader, CopyPasteLoader

import nest_asyncio
from contextlib import contextmanager

# Don't apply nest_asyncio globally as it conflicts with uvicorn's loop_factory parameter
# Instead, apply it conditionally only when needed for specific loaders


@contextmanager
def allow_nested_event_loop():
    """
    Context manager to temporarily enable nested event loops.
    Use this for loaders that may be called from within an existing event loop.
    """
    nest_asyncio.apply()
    try:
        yield
    finally:
        # Note: nest_asyncio doesn't provide an unapply(), so this remains applied
        # for the duration of the process. This is acceptable since we only use
        # this context when we know we need nested loops.
        pass


class Loader:
    LOADER_CLASSES = {
        "gitbook": GitbookLoader,
        "web_scrape": WebBaseLoader,
        "web_scrape_recursive": RecursiveUrlLoader,  # Alias for 'web_base
        "youtube": YoutubeLoader,
        "polygon": BlockchainDocumentLoader,
        "ethereum": BlockchainDocumentLoader,
        "sitemap": SitemapLoader,
        # 'urls': UnstructuredURLLoader,          # Requires `unstructred` pip package (2.07 GB)
        "copy": CopyPasteLoader,
        "txt": TextLoader,
        # 'html': UnstructuredHTMLLoader,			# Requires `unstructred` pip package (2.07 GB)
        # 'md': UnstructuredMarkdownLoader,       # Requires `unstructred` pip package (2.07 GB)
        # 'directory': DirectoryLoader,           # Requires `unstructred` pip package (2.07 GB)
        "csv": CSVLoader,
        "pdf": PyPDFLoader,
        "json": JSONLoader,
        "pandas": DataFrameLoader,  # Requires `pandas`
        "readthedocs": ReadTheDocsLoader,  # Requires `beautifulsoup4`
        "base64": Base64Loader,
    }

    @staticmethod
    def create(
        loader_type: Literal[
            "gitbook",
            "web_base",
            "website",
            "youtube",
            "polygon",
            "ethereum",
            "sitemap",
            "urls",
            "copy",
            "txt",
            "html",
            "md",
            "directory",
            "csv",
            "pdf",
            "json",
            "pandas",
            "readthedocs",
        ],
        loader_config,
    ) -> BaseLoader:
        loader_class = Loader.LOADER_CLASSES.get(loader_type)
        if not loader_class:
            raise ValueError(f"Unsupported document loader type: {loader_type}")

        # Special handling for the 'copy' loader
        if loader_type == "copy":
            return loader_class(text=loader_config.get("text"))

        if loader_type == "pandas":
            return loader_class(
                loader_config.get("df"),
                page_content_column=loader_config.get("page_content_column"),
            )

        if loader_type == "readthedocs":
            return loader_class(path=loader_config.get("path"), features="html.parser")

        if loader_type == "gitbook":
            urls = loader_config.get("urls", [])
            return loader_class(web_page=urls[0], load_all_paths=True)

        # Handling for loaders that require URLs or file paths
        if loader_type == "web_scrape":
            urls = loader_config.get("urls", [])
            return loader_class(web_paths=set(urls))

        # Handling for loaders that require URLs or file paths
        if loader_type in {"sitemap", "web_scrape_recursive"}:
            urls = loader_config.get("urls", [])
            return loader_class(urls[0])

        if loader_type == "youtube":
            urls = loader_config.get("urls", [])
            return loader_class.from_youtube_url(urls[0], add_video_info=False)

        if loader_type == "json":
            return loader_class(
                file_path=loader_config.get("file_path"),
                jq_schema=loader_config.get("jq_schema"),
                text_content=loader_config.get("text_content"),
                json_lines=loader_config.get("json_lines"),
            )

        if loader_type == "base64":
            files = loader_config.get("data", [])
            return loader_class(files)

        # Handling for file-based loaders
        return loader_class(**loader_config)
