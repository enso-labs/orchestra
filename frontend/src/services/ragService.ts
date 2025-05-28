import { Collection } from '@/pages/DocumentManager/types';
import apiClient from '../lib/utils/apiClient';

export const getCollections = async () => {
  try {
    const response = await apiClient.get('/rag/collections');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteCollection = async (collectionId: string) => {
  try {
    const response = await apiClient.delete(`/rag/collections/${collectionId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateCollection = async (collectionId: string, collection: Collection) => {
  try {
    const response = await apiClient.put(`/rag/collections/${collectionId}`, collection);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const createCollection = async (collection: Collection) => {
  try {
    const response = await apiClient.post('/rag/collections', collection);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getDocuments = async (collectionId: string) => {
  try {
    const response = await apiClient.get(`/rag/collections/${collectionId}/documents`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const addDocument = async (collectionId: string, document: Document) => {
  try {
    const response = await apiClient.post(`/rag/collections/${collectionId}/documents`, document);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteDocument = async (collectionId: string, documentId: string) => {
  try {
    const response = await apiClient.delete(`/rag/collections/${collectionId}/documents/${documentId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const searchDocuments = async (collectionId: string, query: string, limit: number, filter: any) => {
  try {
    const response = await apiClient.post(`/rag/collections/${collectionId}/documents/search`, { query, limit, filter });
    return response.data;
  } catch (error) {
    throw error;
  }
};