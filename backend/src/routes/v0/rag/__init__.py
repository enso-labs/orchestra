from fastapi import Depends, Request, APIRouter
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer

from src.utils.openapi import fetch_openapi_spec_sync
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
		responses=CLIENT_SPEC["paths"]["/collections"]["get"]["responses"],
		summary=CLIENT_SPEC["paths"]["/collections"]["get"]["summary"],
		description=CLIENT_SPEC["paths"]["/collections"]["get"]["description"],
		operation_id=CLIENT_SPEC["paths"]["/collections"]["get"]["operationId"],
	)
	async def collection_list(request: Request):
		response = await forward(request)
		return JSONResponse(status_code=response.status_code, content=response.json())

	@gateway.post(
		"/rag/collections",
		dependencies=[Depends(HTTPBearer())],
		tags=[TAG],
		responses=CLIENT_SPEC["paths"]["/collections"]["post"]["responses"],
		summary=CLIENT_SPEC["paths"]["/collections"]["post"]["summary"],
		description=CLIENT_SPEC["paths"]["/collections"]["post"]["description"],
		operation_id=CLIENT_SPEC["paths"]["/collections"]["post"]["operationId"],
	)
	async def collection_create(request: Request):
		response = await forward(request)
		return JSONResponse(status_code=response.status_code, content=response.json())

	@gateway.get(
		"/rag/collections/{collection_id}",
		dependencies=[Depends(HTTPBearer())],
		tags=[TAG],
		responses=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["get"]["responses"],
		summary=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["get"]["summary"],
		description=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["get"]["description"],
		operation_id=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["get"]["operationId"],
	)
	async def collection_get(request: Request):
		response = await forward(request)
		return JSONResponse(status_code=response.status_code, content=response.json())

	@gateway.patch(
		"/rag/collections/{collection_id}",
		dependencies=[Depends(HTTPBearer())],
		tags=[TAG],
		summary=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["patch"]["summary"],
		description=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["patch"]["description"],
		operation_id=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["patch"]["operationId"],
		responses=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["patch"]["responses"],
	)
	async def collection_update(request: Request):
		response = await forward(request)
		return JSONResponse(status_code=response.status_code, content=response.json())

	@gateway.delete(
		"/rag/collections/{collection_id}",
		dependencies=[Depends(HTTPBearer())],
		tags=[TAG],
		responses=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["delete"]["responses"],
		summary=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["delete"]["summary"],
		description=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["delete"]["description"],
		operation_id=CLIENT_SPEC["paths"]["/collections/{collection_id}"]["delete"]["operationId"],
	)
	async def collection_delete(request: Request):
		response = await forward(request)
		return JSONResponse(status_code=response.status_code, content=response.json())


	#####################################################################################################
	## Documents
	#####################################################################################################
	@gateway.get(
		"/rag/collections/{collection_id}/documents",
		dependencies=[Depends(HTTPBearer())],
		tags=[TAG],
		responses=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents"]["get"]["responses"],
		summary=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents"]["get"]["summary"],
		description=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents"]["get"]["description"],
		operation_id=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents"]["get"]["operationId"],
	)
	async def documents_list(request: Request):
		response = await forward(request)
		return JSONResponse(status_code=response.status_code, content=response.json())

	@gateway.post(
		"/rag/collections/{collection_id}/documents",
		dependencies=[Depends(HTTPBearer())],
		tags=[TAG],
		responses=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents"]["post"]["responses"],
		summary=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents"]["post"]["summary"],
		description=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents"]["post"]["description"],
		operation_id=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents"]["post"]["operationId"],
	)
	async def documents_create(request: Request):
		response = await forward(request)
		return JSONResponse(status_code=response.status_code, content=response.json())

	@gateway.post(
		"/rag/collections/{collection_id}/documents/search",
		dependencies=[Depends(HTTPBearer())],
		tags=[TAG],
		responses=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents/search"]["post"]["responses"],
		summary=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents/search"]["post"]["summary"],
		description=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents/search"]["post"]["description"],
		operation_id=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents/search"]["post"]["operationId"],
	)
	async def documents_search(request: Request):
		response = await forward(request)
		return JSONResponse(status_code=response.status_code, content=response.json())

	@gateway.delete(
		"/rag/collections/{collection_id}/documents/{document_id}",
		dependencies=[Depends(HTTPBearer())],
		tags=[TAG],
		responses=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents/{document_id}"]["delete"]["responses"],
		summary=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents/{document_id}"]["delete"]["summary"],
		description=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents/{document_id}"]["delete"]["description"],
		operation_id=CLIENT_SPEC["paths"]["/collections/{collection_id}/documents/{document_id}"]["delete"]["operationId"],
	)
	async def documents_delete(request: Request):
		response = await forward(request)
		return JSONResponse(status_code=response.status_code, content=response.json())