import apiClient from '@/lib/utils/apiClient';

export const findThread = async (threadId: string) => {
  const response = await apiClient.get(`/v0/thread/${threadId}`);
  return response.data;
};