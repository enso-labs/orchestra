import apiClient from '../lib/utils/apiClient';

export const listSettings = async () => {
  const response = await apiClient.get('/v0/settings');
  return response.data;
};

export const deleteSetting = async (id: string) => {
  const response = await apiClient.delete(`/v0/settings/${id}`);
  return response.data;
};
