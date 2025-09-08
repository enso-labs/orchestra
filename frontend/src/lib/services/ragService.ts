import { Collection } from "@/pages/DocumentManager/types";
import apiClient from "@/lib/utils/apiClient";

export const getCollections = async () => {
	const response = await apiClient.get("/rag/collections");
	return response.data;
};

export const deleteCollection = async (collectionId: string) => {
	const response = await apiClient.delete(`/rag/collections/${collectionId}`);
	return response.data;
};

export const updateCollection = async (
	collectionId: string,
	collection: Collection,
) => {
	const response = await apiClient.patch(
		`/rag/collections/${collectionId}`,
		collection,
	);
	return response.data;
};

export const createCollection = async (collection: Collection) => {
	const response = await apiClient.post("/rag/collections", collection);
	return response.data;
};

export const getDocuments = async (collectionId: string) => {
	const response = await apiClient.get(
		`/rag/collections/${collectionId}/documents`,
	);
	return response.data;
};

export const addDocuments = async (collectionId: string, files: FormData) => {
	const response = await apiClient.post(
		`/rag/collections/${collectionId}/documents`,
		files,
		{
			headers: {
				"Content-Type": "multipart/form-data",
			},
		},
	);
	return response.data;
};

export const deleteDocument = async (
	collectionId: string,
	documentId: string,
) => {
	const response = await apiClient.delete(
		`/rag/collections/${collectionId}/documents/${documentId}`,
	);
	return response.data;
};

export const searchDocuments = async (
	collectionId: string,
	query: string,
	limit: number,
	filter: any,
) => {
	const response = await apiClient.post(
		`/rag/collections/${collectionId}/documents/search`,
		{ query, limit, filter },
	);
	return response.data;
};
