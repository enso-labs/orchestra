export interface ThreadPayload {
  threadId?: string;
  images?: string[];
  query: string;
  system?: string;
  tools?: any[];
  visualize?: boolean;
  model?: string;
  mcp?: object|null;
}

export type Agent = {
  id: string
  name: string
  description: string
  setting?: {
    value: {
      model?: string
    }
  }
  public: boolean
  categories?: string[]
  users?: number
  rating?: number
  owner?: string
  created_at: string
}

export type DashboardTabOption = "agents" | "workflows" | "servers"