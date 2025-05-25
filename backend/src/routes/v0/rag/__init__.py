from typing import Any
from uuid import UUID
from fastapi import Depends, File, Form, Query, Request, APIRouter, UploadFile, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer

from src.utils.openapi import fetch_openapi_spec_sync, get_response_model
from src.utils.retrieval import forward
from src.constants import LANGCONNECT_SERVER_URL


CLIENT_SPEC = fetch_openapi_spec_sync(f"{LANGCONNECT_SERVER_URL}/openapi.json") if LANGCONNECT_SERVER_URL else None
TAG = "RAG"
if CLIENT_SPEC:
	gateway = APIRouter()
	@gateway.get(
		"/rag/collections",
		dependencies=[Depends(HTTPBearer())],
		tags=[TAG],
		responses={
			status.HTTP_200_OK: CLIENT_SPEC["paths"]["/collections"]["get"]["responses"]["200"],
		},
		summary=CLIENT_SPEC["paths"]["/collections"]["get"]["summary"],
		description=CLIENT_SPEC["paths"]["/collections"]["get"]["description"],
		# response_model=list[get_response_model("CollectionResponse", CLIENT_SPEC)],
	)
	async def collection_list(request: Request):
		response = await forward(request)
		return JSONResponse(status_code=response.status_code, content=response.json())

	@gateway.post(
		"/rag/collections",
		dependencies=[Depends(HTTPBearer())],
		tags=[TAG],
		responses={
			status.HTTP_201_CREATED: CLIENT_SPEC["paths"]["/collections"]["post"]["responses"]["201"],
			status.HTTP_422_UNPROCESSABLE_ENTITY: CLIENT_SPEC["paths"]["/collections"]["post"]["responses"]["422"],
		},
		status_code=status.HTTP_201_CREATED,
		summary=CLIENT_SPEC["paths"]["/collections"]["post"]["summary"],
		description=CLIENT_SPEC["paths"]["/collections"]["post"]["description"],
		response_model=get_response_model("CollectionCreate", CLIENT_SPEC),
	)
	async def collection_create(
		request: Request, 
		collection_data: get_response_model("CollectionCreate", CLIENT_SPEC) # type: ignore
	):
		response = await forward(request)
		return JSONResponse(status_code=response.status_code, content=response.json())

	@gateway.get(
		"/rag/collections/{collection_id}",
		dependencies=[Depends(HTTPBearer())],
		tags=[TAG],
		responses={
			status.HTTP_200_OK: CLIENT_SPEC["paths"]["/collections/{collection_id}"]["get"]["responses"]["200"],
		},
		summary=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["get"]["summary"],
		description=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["get"]["description"],
		response_model=get_response_model("CollectionResponse", CLIENT_SPEC),
	)
	async def collection_get(
		request: Request, 
		collection_id: UUID
	):
		response = await forward(request)
		return JSONResponse(status_code=response.status_code, content=response.json())

	@gateway.patch(
		"/rag/collections/{collection_id}",
		dependencies=[Depends(HTTPBearer())],
		tags=[TAG],
		summary=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["patch"]["summary"],
		description=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["patch"]["description"],
		operation_id=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["patch"]["operationId"],
		responses={
			status.HTTP_200_OK: CLIENT_SPEC["paths"]["/collections/{collection_id}"]["patch"]["responses"]["200"],
		},
		response_model=get_response_model("CollectionResponse", CLIENT_SPEC),
	)
	async def collection_update(
		request: Request, 
		collection_id: UUID, 
		collection_data: get_response_model("CollectionCreate", CLIENT_SPEC) # type: ignore
    ):
		response = await forward(request)
		return JSONResponse(status_code=response.status_code, content=response.json())

	@gateway.delete(
		"/rag/collections/{collection_id}",
		dependencies=[Depends(HTTPBearer())],
		tags=[TAG],
		status_code=status.HTTP_204_NO_CONTENT,
		summary=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["delete"]["summary"],
		description=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["delete"]["description"],
		operation_id=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["delete"]["operationId"],
	)
	async def collection_delete(
		request: Request, 
		collection_id: UUID
	):
		response = await forward(request)
		return JSONResponse(status_code=response.status_code, content=response.json())


	#####################################################################################################
	## Documents
	#####################################################################################################
	@gateway.get(
		"/rag/collections/{collection_id}/documents",
		dependencies=[Depends(HTTPBearer())],
		tags=[TAG],
		responses={
			status.HTTP_200_OK: CLIENT_SPEC["paths"]["/collections/{collection_id}/documents"]["get"]["responses"]["200"],
		},
		summary=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents"]["get"]["summary"],
		description=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents"]["get"]["description"],
		operation_id=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents"]["get"]["operationId"],
		response_model=list[get_response_model("DocumentResponse", CLIENT_SPEC)],
	)
	async def documents_list(
		request: Request, 
		collection_id: UUID,
		limit: int = Query(10, ge=1, le=100),
		offset: int = Query(0, ge=0),
	):
		response = await forward(request)
		return JSONResponse(status_code=response.status_code, content=response.json())

	@gateway.post(
		"/rag/collections/{collection_id}/documents",
		dependencies=[Depends(HTTPBearer())],
		tags=[TAG],
		responses={
			status.HTTP_200_OK: CLIENT_SPEC["paths"]["/collections/{collection_id}/documents"]["post"]["responses"]["200"],
		},
		summary=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents"]["post"]["summary"],
		description=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents"]["post"]["description"],
		operation_id=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents"]["post"]["operationId"],
		response_model=dict[str, Any],
	)
	async def documents_create(
		request: Request, 
		collection_id: UUID,
		files: list[UploadFile] = File(...),
		metadatas_json: str | None = Form(None),
	):
		response = await forward(request)
		return JSONResponse(status_code=response.status_code, content=response.json())

	@gateway.post(
		"/rag/collections/{collection_id}/documents/search",
		dependencies=[Depends(HTTPBearer())],
		tags=[TAG],
		responses={
			status.HTTP_200_OK: {
				"description": "Search results",
				"content": {
					"application/json": {
						"example": [
							{
								"id": "string",
								"page_content": "string",
								"metadata": {
									"additionalProp1": {}
								},
								"score": 0
							}
						]
					}
				}
			}
		},
		summary=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents/search"]["post"]["summary"],
		description=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents/search"]["post"]["description"],
		operation_id=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents/search"]["post"]["operationId"],
		# response_model=list[get_response_model("SearchResult", CLIENT_SPEC)],
	)
	async def documents_search(
		request: Request, 
		collection_id: UUID, 
		search_query: get_response_model("SearchQuery", CLIENT_SPEC) # type: ignore
	):
		response = await forward(request)
		return JSONResponse(status_code=response.status_code, content=response.json())

	@gateway.delete(
		"/rag/collections/{collection_id}/documents/{document_id}",
		dependencies=[Depends(HTTPBearer())],
		tags=[TAG],
		responses={
			status.HTTP_200_OK: CLIENT_SPEC["paths"]["/collections/{collection_id}/documents/{document_id}"]["delete"]["responses"]["200"],
		},
		summary=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents/{document_id}"]["delete"]["summary"],
		description=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents/{document_id}"]["delete"]["description"],
		operation_id=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents/{document_id}"]["delete"]["operationId"],
		# response_model=dict[str, bool],
	)
	async def documents_delete(
		request: Request, 
		collection_id: UUID,
    	document_id: str,
	):
		response = await forward(request)
		return JSONResponse(status_code=response.status_code, content=response.json())