import apiClient from '../lib/utils/apiClient';

export const listTools = async () => {
  const response = await apiClient.get('/tools');
  return response.data;
};

export const listToolsArcade = async (toolkit?: string, offset?: number, limit?: number) => {
  const params = new URLSearchParams();
  if (toolkit) params.append('toolkit', toolkit);
  if (offset !== undefined) params.append('offset', offset.toString());
  if (limit !== undefined) params.append('limit', limit.toString());
  
  const response = await apiClient.get(`/tools/arcade${params.toString() ? `?${params.toString()}` : ''}`);
  return response;
};

export const getToolArcade = async (name: string) => {
  const response = await apiClient.get(`/tools/arcade/${name}`);
  return response;
};

export const getServerInfo = async (type: string, config: any) => {
  const response = await apiClient.post(`/tools/${type}/info`, config);
  return response;
};

export const getDefaultSpec = async () => {
  const response = await fetch("https://raw.githubusercontent.com/ryaneggz/static/refs/heads/main/enso/airtable-spec.json");
  const data = await response.json();
  return data;
};

export const convertSpecToTool = async (
  name: string,
  description: string,
  spec: any,
  headers: any
) => {
  return {
    name,
    description,
    spec,
    headers
  }
};