import apiClient from '../lib/utils/apiClient';

export const getCollections = async () => {
  try {
    const response = await apiClient.get('/rag/collections');
    return response.data;
  } catch (error) {
    throw error;
  }
};

