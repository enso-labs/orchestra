export interface ThreadPayload {
  threadId?: string;
  images: string[];
  query: string;
  system: string;
  tools: any[];
  visualize: boolean;
  model: string;
  mcp: object|null;
}