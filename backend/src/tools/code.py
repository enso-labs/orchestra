import os
import ujson
import httpx
import logging
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from langchain_core.tools import tool

# TODO: Uncomment when langchain-sandbox is updated for langchain-core>=1.0
# from langchain_sandbox import PyodideSandbox
PyodideSandbox: Optional[type] = None
try:
    from langchain_sandbox import PyodideSandbox  # type: ignore
except ImportError:
    pass

from langchain_core.tools import BaseToolkit
from langchain_core.tools import StructuredTool
from langchain_core.tools import ToolException


########################################################
## Model
########################################################
class ExecuteSchema(BaseModel):
    session_id: str = Field(..., description="The session ID")
    code: str = Field(..., description="The code to execute")
    env: dict = Field(default={}, description="The environment variables")


class InstallSchema(BaseModel):
    session_id: str = Field(..., description="The session ID")
    packages: List[str] = Field(..., description="The packages to install")


class TerminateSchema(BaseModel):
    session_id: str = Field(..., description="The session ID")


class UploadSchema(BaseModel):
    session_id: str = Field(..., description="The session ID")
    file_path: str = Field(..., description="The path to the file to upload")


class DownloadSchema(BaseModel):
    session_id: str = Field(..., description="The session ID")
    filename: str = Field(..., description="The name of the file to download")


########################################################
## Class
########################################################
class Interpreter:
    def __init__(self, api_url: str = "http://localhost:8000"):
        self.api_url = api_url

    def install(self, session_id: str, packages: List[str]):
        """
        Installs the specified packages in a session.

        Args:
            session_id (str): The ID of the session.
            packages (List[str]): The list of packages to install.

        Returns:
            dict: The JSON response containing the result of the installation.

        Raises:
            ToolException: If there is an error installing the packages.

        """
        url = f"{self.api_url}/install"
        headers = {"Content-Type": "application/json"}
        data = {"session_id": session_id, "packages": packages}

        response = httpx.post(url, headers=headers, json=data)
        if response.status_code == 200:
            logging.info("Packages installed successfully:", response.json())
            return response.json()
        else:
            logging.error("Error installing packages:", response.status_code, response.text)
            raise ToolException(f"Error: {response.status_code} {response.text}")

    def execute(self, session_id: str, code: str):
        """
        Executes the given code in the specified session.

        Args:
            session_id (str): The ID of the session.
            code (str): The code to be executed.

        Returns:
            dict: The JSON response containing the result of the execution.

        Raises:
            ToolException: If there is an error executing the code.

        """
        url = f"{self.api_url}/execute"
        headers = {"Content-Type": "application/json"}
        data = {"session_id": session_id, "code": code}

        response = httpx.post(url, headers=headers, json=data)
        if response.status_code == 200:
            logging.info("Success:", response.json())
            return response.json()
        else:
            logging.error("Error:", response.status_code, response.text)
            raise ToolException(f"Error: {response.status_code} {response.text}")

    def terminate(self, session_id: str):
        """
        Terminates the specified session.

        Args:
            session_id (str): The ID of the session to be terminated.

        Returns:
            dict: The JSON response containing the result of the termination.

        Raises:
            ToolException: If there is an error terminating the session.
        """
        url = f"{self.api_url}/terminate"
        headers = {"Content-Type": "application/json"}
        data = {"session_id": session_id}

        response = httpx.post(url, headers=headers, json=data)
        if response.status_code == 200:
            logging.info("Session terminated successfully:", response.json())
            return response.json()
        else:
            logging.error("Error terminating session:", response.status_code, response.text)
            raise ToolException(f"Error: {response.status_code} {response.text}")

    def upload(self, session_id: str, file_path: str):
        """
        Uploads a file to the server.

        Args:
            session_id (str): The ID of the session.
            file_path (str): The path to the file to upload.

        Returns:
            dict: The JSON response containing the result of the upload.

        Raises:
            ToolException: If there is an error uploading the file.
        """
        # Construct the URL for the upload endpoint
        url = f"{self.api_url}/upload"

        # Set the headers for the request
        headers = {"accept": "application/json"}

        # Set the files to upload
        files = {
            "session_id": (None, session_id),  # The session ID
            "file": (file_path, open(file_path, "rb")),  # The file to upload
        }

        # Send the POST request to the server
        response = httpx.post(url, headers=headers, files=files)

        # Check if the upload was successful
        if response.status_code == 200:
            # Log the success and return the response
            logging.info("File uploaded successfully:", response.json())
            return response.json()
        else:
            # Log the error and raise an exception
            logging.error("Error uploading file:", response.status_code, response.text)
            raise ToolException(f"Error: {response.status_code} {response.text}")

    def download(self, session_id: str, filename: str, output_path: str):
        """
        Downloads a file from the server using the given session ID and filename.

        Args:
            session_id (str): The ID of the session.
            filename (str): The name of the file to download.
            output_path (str): The path where the downloaded file will be saved.

        Returns:
            dict: A dictionary containing the status of the download and the output path.

        Raises:
            ToolException: If there is an error downloading the file.

        """
        url = f"{self.api_url}/download"
        params = {"session_id": session_id, "filename": filename}

        response = httpx.get(url, params=params)
        if response.status_code == 200:
            with open(output_path, "wb") as f:
                f.write(response.content)
            logging.info("File downloaded successfully:", output_path)
            return {"status": "success", "output_path": output_path}
        else:
            logging.error("Error downloading file:", response.status_code, response.text)
            raise ToolException(f"Error: {response.status_code} {response.text}")

    def toolkit(self) -> List[StructuredTool]:
        """
        Creates a toolkit of structured tools.

        Returns:
            list: A list of structured tools.

        """
        execute_tool = StructuredTool.from_function(
            args_schema=ExecuteSchema,
            func=self.execute,
            name="execute_code",
            description="Use this tool to execute python code.",
            handle_tool_error=True,
        )
        install_tool = StructuredTool.from_function(
            args_schema=InstallSchema,
            func=self.install,
            name="install_packages",
            description="Use this tool to install python packages.",
            handle_tool_error=True,
        )
        terminate_tool = StructuredTool.from_function(
            args_schema=TerminateSchema,
            func=self.terminate,
            name="terminate_session",
            description="Use this tool to terminate the session.",
            handle_tool_error=True,
        )
        upload_tool = StructuredTool.from_function(
            args_schema=UploadSchema,
            func=self.upload,
            name="upload_file",
            description="Use this tool to upload a file.",
            handle_tool_error=True,
        )
        download_tool = StructuredTool.from_function(
            args_schema=DownloadSchema,
            func=self.download,
            name="download_file",
            description="Use this tool to download a file.",
            handle_tool_error=True,
        )
        return [
            execute_tool,
            install_tool,
            terminate_tool,
            upload_tool,
            download_tool,
        ]


########################################################
## Test
########################################################
class InterpreterToolkit(BaseToolkit):
    """Toolkit for the interpreter."""

    api_url: str = Field(default=os.getenv("INTERPRETER_URL", "http://localhost:8100"))

    model_config = ConfigDict(arbitrary_types_allowed=True)

    def get_tools(self) -> List[StructuredTool]:
        """Get the tools in the toolkit."""
        toolkit = Interpreter(api_url=self.api_url).toolkit()
        return toolkit


@tool
async def python_sandbox(code: str):
    """Use this tool to execute python code in a sandbox.

    Example:
        >>> python_sandbox("print('Hello, World!')")
        "Hello, World!"
        >>> python_sandbox("import math; math.sqrt(16)")
        "4.0"

    Args:
        code (str): The python code to execute.
    """
    if PyodideSandbox is None:
        return "Error: langchain-sandbox is not installed. Use the Interpreter toolkit instead."
    try:
        sandbox = PyodideSandbox(allow_net=True, sessions_dir="./pysandbox")
        code_exec_result = await sandbox.execute(code)
        return ujson.dumps(code_exec_result.__dict__)
    except Exception as e:
        return f"Error: {e}"


# Use InterpreterToolkit when langchain-sandbox is unavailable
# PYTHON_CODE_INTERPRETER_TOOLS = InterpreterToolkit().get_tools()
PYTHON_CODE_INTERPRETER_TOOLS = [python_sandbox] if PyodideSandbox else []
