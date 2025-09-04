export interface ThreadPayload {
  threadId?: string;
  images?: string[];
  query: string;
  system?: string;
  tools?: any[];
  visualize?: boolean;
  model?: string;
  memory?: boolean;
  mcp?: object|null;
  collection?: object|null;
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

export type Server = {
  id?: string;
  name: string;
  description: string;
  slug?: string;
  type: "mcp" | "a2a";
  config: {
    transport?: string;
    base_url?: string;
    url?: string;
    headers?: Record<string, string>;
    agent_card_path?: string;
  };
  documentation?: string;
  documentation_url?: string;
  public: boolean;
  categories?: string[];
  created_at?: string;
}

export type DashboardTabOption = "agents" | "workflows" | "servers"

export type LLMStreamPayload = {
  model: string;
  system: string;
  stream_mode: string;
  messages: {
    role: string;
    content: string;
  }[];
  metadata?: {
    thread_id?: string;
    checkpoint_id?: string;
  };
}