import apiClient from '../lib/utils/apiClient';

export const listTools = async () => {
  const response = await apiClient.get('/tools');
  return response.data;
};


interface ServerInfo {
  transport: string;
  url: string;
  headers?: Record<string, string>;
  [key: string]: any;
}

export const getServerInfo = async (type: string, config: any) => {
  const response = await apiClient.post(`/tools/${type}/info`, config);
  return response;
};