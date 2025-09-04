"""Storage Service using MinIO"""

import os
from src.utils.logger import logger as logging
import datetime
import threading
import mimetypes
from fastapi import UploadFile
from minio import Minio
from minio.error import S3Error

from src.constants import MINIO_HOST, S3_REGION


class StorageService:
    """Storage Service Class for MinIO"""

    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(StorageService, cls).__new__(cls)
        return cls._instance

    def __init__(self, access_key_id, secret_access_key, minio_server: str = None):
        self.minio_server = (
            minio_server
            if minio_server
            else (MINIO_HOST or f"s3.{S3_REGION}.amazonaws.com")
        )
        self.access_key_id = access_key_id
        self.secret_access_key = secret_access_key
        self.client = Minio(
            endpoint=self.minio_server,
            access_key=self.access_key_id,
            secret_key=self.secret_access_key,
            secure=False if MINIO_HOST else True,
        )

    def retrieve_all_files_raw(self, bucket: str, prefix: str = ""):
        """Retrieve all file details from a bucket"""
        files = []
        try:
            objects = self.client.list_objects(bucket, prefix=prefix, recursive=True)
            for obj in objects:
                files.append(obj)
        except S3Error as err:
            logging.error("Error retrieving files: %s", err)
        return files

    def retrieve_all_files(self, bucket: str, prefix: str = ""):
        """Retrieve all files from a bucket with detailed information

        :param bucket: The bucket name
        :param prefix: Optional prefix to filter files
        :return: List of dictionaries containing file details
        """
        files = []
        try:
            objects = self.client.list_objects(bucket, prefix=prefix, recursive=True)
            for obj in objects:
                # Get the file extension
                _, extension = os.path.splitext(obj.object_name)
                extension = extension.lower().strip(".")

                # Create a response similar to upload_and_get_presigned_urls
                file_info = {
                    "filename": os.path.basename(obj.object_name),
                    "size": obj.size,
                    "content_type": mimetypes.guess_type(obj.object_name)[0]
                    or "application/octet-stream",
                    "object_name": obj.object_name,
                    "last_modified": obj.last_modified.isoformat(),
                    "etag": obj.etag,
                    "directory": os.path.dirname(obj.object_name),
                }
                files.append(file_info)
        except S3Error as err:
            logging.error("Error retrieving files: %s", err)
        return files

    def retrieve_file(self, bucket: str, path: str):
        """Retrieve a file from a bucket"""
        try:
            response = self.client.get_object(bucket, path)
            return response.data
        except S3Error as err:
            logging.error("Error retrieving file %s: %s", path, err)
            return None

    def delete_file(self, bucket: str, path: str):
        """Delete a file from a bucket"""
        try:
            self.client.remove_object(bucket, path)
        except S3Error as err:
            logging.error("Error deleting file %s: %s", path, err)
            raise ValueError(f"Failed to delete file: {err}") from err

    def upload_file(
        self, upload_file: UploadFile, bucket, directory=None, object_name=None
    ):
        """Upload a file to a MinIO bucket asynchronously with appropriate content type"""
        if object_name is None:
            object_name = upload_file.filename

        content_type = upload_file.content_type
        if content_type is None:
            content_type = "application/octet-stream"  # Default MIME type if unknown

        # Prepend directory to object name if specified
        object_name = os.path.join(directory, object_name) if directory else object_name

        def upload_action():
            try:
                file_data = upload_file.file
                self.client.put_object(
                    bucket,
                    object_name,
                    file_data,
                    upload_file.size,
                    content_type=content_type,
                )
                logging.info(
                    f"Successfully uploaded {upload_file.filename} to {object_name}"
                )
            except S3Error as err:
                logging.error("Error uploading file %s: %s", upload_file.filename, err)

        thread = threading.Thread(target=upload_action)
        thread.start()
        return thread

    def upload_files(self, files, bucket, prefix=None):
        """Upload multiple files concurrently.
        :param files: List of FastAPI UploadFile objects
        :param bucket: Bucket to upload to
        """
        threads = []
        for file in files:
            extension = os.path.splitext(file.filename)[1].lower()
            directory = (
                f"{prefix}/{extension.strip('.')}" if prefix else extension.strip(".")
            )
            thread = self.upload_file(file, bucket, directory=directory)
            threads.append(thread)

        for thread in threads:
            thread.join()

        return [
            {
                "filename": file.filename,
                "size": file.size,
                "content_type": file.content_type,
            }
            for file in files
        ]

    def create_presigned_urls(
        self,
        bucket,
        object_names,
        expiration=3600,
        response_content_type=None,
        inline=True,
    ):
        """
        Generate presigned URLs for a list of objects, optionally setting response content type and disposition.

        :param bucket: The name of the bucket.
        :param object_names: List of object names in the bucket.
        :param expiration: The expiration time in seconds (default is 3600 seconds, or 1 hour).
        :param response_content_type: Optional override for 'Content-Type' on response.
        :param inline: Whether to set 'Content-Disposition' to 'inline' or 'attachment'.
        :return: Dictionary of object names to their presigned URLs or None if an error occurs.
        """
        urls = {}
        expiration_delta = datetime.timedelta(seconds=expiration)
        for object_name in object_names:
            response_headers = {}
            if response_content_type:
                response_headers["response-content-type"] = response_content_type
            if inline:
                response_headers["response-content-disposition"] = "inline"
            else:
                response_headers["response-content-disposition"] = "attachment"

            try:
                url = self.client.presigned_get_object(
                    bucket,
                    object_name,
                    expires=expiration_delta,
                    response_headers=response_headers,
                )
                if url:
                    urls[object_name] = url
            except S3Error as err:
                logging.error(
                    f"Error generating presigned URL for {object_name}: {err}"
                )
                continue
        return urls

    def upload_and_get_presigned_urls(
        self, files, bucket, prefix=None, expiration=3600, include_presigned=False
    ):
        """Upload files and return their info with direct URLs and optional presigned URLs
        :param files: List of FastAPI UploadFile objects
        :param bucket: Bucket to upload to
        :param prefix: Optional prefix for organizing files
        :param expiration: Expiration time for presigned URLs in seconds
        :param include_presigned: Whether to include presigned URLs in the response
        :return: List of dictionaries containing file info and URLs
        """
        # First upload all files
        upload_results = self.upload_files(files, bucket, prefix)

        # Get object names and generate URLs for all uploaded files
        object_names = []
        for file in files:
            extension = os.path.splitext(file.filename)[1].lower()
            directory = (
                f"{prefix}/{extension.strip('.')}" if prefix else extension.strip(".")
            )
            object_name = os.path.join(directory, file.filename)
            object_names.append(object_name)

        # Generate presigned URLs if requested
        presigned_urls = {}
        if include_presigned:
            presigned_urls = self.create_presigned_urls(
                bucket, object_names, expiration=expiration
            )

        # Combine results with direct URLs and optional presigned URLs
        results = []
        for upload_info, object_name in zip(upload_results, object_names):
            # Generate direct URL using the MinIO server endpoint
            direct_url = f"{self.minio_server}/{bucket}/{object_name}"
            if direct_url.startswith("http://localhost"):
                # Replace localhost with your actual domain if needed
                direct_url = direct_url.replace("http://localhost", "http://127.0.0.1")

            result = {
                **upload_info,
                "object_name": object_name,
                "directory": os.path.dirname(object_name),
                "url": "https://" + direct_url,  # Direct URL without authentication
            }
            if include_presigned:
                result["presigned_url"] = presigned_urls.get(object_name)
            results.append(result)

        return results
