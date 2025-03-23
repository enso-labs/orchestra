import apiClient from "../lib/utils/apiClient";

export const getAgents = async () => {
  try {
    const response = await apiClient.get('/agents');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getAgent = async (agentId: string) => {
  try {
    const response = await apiClient.get(`/agents/${agentId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const createAgent = async (data: {
  name: string;
  description: string;
  settings_id: string;
  public?: boolean;
}) => {
  try {
    const response = await apiClient.post('/agents', data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateAgent = async (
  agentId: string,
  data: {
    name?: string;
    description?: string;
    // settings_id?: string;
    public?: boolean;
  }
) => {
  try {
    const response = await apiClient.put(`/agents/${agentId}`, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteAgent = async (agentId: string) => {
  try {
    const response = await apiClient.delete(`/agents/${agentId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};


export const createAgentRevision = async (agentId: string, data: {
  name: string;
  description: string;
  settings_id: string;
}) => {
  try {
    const response = await apiClient.post(`/agents/${agentId}/v`, data);
    return response;
  } catch (error) {
    throw error;
  }
};