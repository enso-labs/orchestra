import apiClient from '../lib/utils/apiClient';

export const listServers = async (limit: number = 100, offset: number = 0, type: string = 'mcp') => {
  const response = await apiClient.get('/servers', { params: { limit, offset, type } });
  return response;
};

export const listPublicServers = async (limit: number = 100, offset: number = 0, type: string = 'mcp') => {
  const response = await apiClient.get('/servers/public', { params: { limit, offset, type } });
  return response;
};

export const getServer = async (serverId: string) => {
  const response = await apiClient.get(`/servers/${serverId}`);
  return response;
};
