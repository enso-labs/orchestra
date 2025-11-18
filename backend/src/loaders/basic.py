import os
import tempfile
import base64
from pypdf import PdfReader
from langchain_core.document_loaders.base import BaseLoader
from langchain_core.documents import Document


class CopyPasteLoader(BaseLoader):
    def __init__(self, text):
        self.text = text

    def load(self):
        return [Document(page_content=self.text)]


class Base64Loader(BaseLoader):
    def __init__(self, files):
        self.files = files

    def _process_pdf(self, pdf_bytes, filename):
        # Create a temporary directory to handle PDF processing
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = os.path.join(temp_dir, filename)
            with open(file_path, "wb") as f:
                f.write(pdf_bytes)
            # Reading the PDF file using PyPDF2
            return self._read_pdf(file_path, filename)

    def _read_pdf(self, file_path, filename):
        reader = PdfReader(file_path)
        full_text = []
        for page in reader.pages:
            text = page.extract_text()
            if text:  # Only add text if it exists
                full_text.append(text)
        return Document(page_content="".join(full_text), metadata={"source": filename})

    def load(self):
        documents = []
        for file in self.files:
            # Handle both string format (e.g., "data:text/plain;base64,SGVsbG8=")
            # and dict format (e.g., {"src": "data:...", "type": "...", "name": "..."})
            if isinstance(file, str):
                # Parse the data URI string
                if "base64," in file:
                    base64_string = file.split("base64,")[-1]
                    # Extract MIME type from data URI
                    mime_type = file.split(":")[1].split(";")[0] if ":" in file else "text/plain"
                    file_name = "uploaded_file"
                else:
                    raise ValueError(f"Invalid base64 data format: {file}")
            else:
                # Dictionary format
                base64_string = file["src"].split("base64,")[-1]
                mime_type = file.get("type", "text/plain")
                file_name = file.get("name", "uploaded_file")

            content_bytes = base64.b64decode(base64_string)

            if mime_type == "application/pdf":
                # Process PDF using a temporary file
                document = self._process_pdf(content_bytes, file_name)
            else:
                try:
                    content = content_bytes.decode("utf-8")
                except UnicodeDecodeError:
                    content = "Error decoding data: Data is not valid UTF-8."
                document = Document(
                    page_content=content, metadata={"source": file_name}
                )

            documents.append(document)
        return documents
