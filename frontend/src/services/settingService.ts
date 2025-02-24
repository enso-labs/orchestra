import apiClient from '../lib/utils/apiClient';

export const listSettings = async () => {
  const response = await apiClient.get('/settings');
  return response.data;
};

export const deleteSetting = async (id: string) => {
  const response = await apiClient.delete(`/settings/${id}`);
  return response.data;
};
