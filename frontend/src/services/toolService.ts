import apiClient from '../lib/utils/apiClient';

export const listTools = async () => {
  const response = await apiClient.get('/v0/tools');
  return response.data;
};