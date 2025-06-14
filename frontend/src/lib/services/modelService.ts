import apiClient from '@/lib/utils/apiClient';

export interface ModelMetadata {
  system_message: boolean;
  reasoning: boolean;
  tool_calling: boolean;
  multimodal: boolean;
  embedding: boolean;
}

export interface Model {
  id: string;
  label: string;
  provider: string;
  metadata: ModelMetadata;
}

export interface ModelsResponse {
  models: Model[];
}

export const listModels = async () => {
  const response = await apiClient.get<ModelsResponse>('/models');
  return response.data;
}; 