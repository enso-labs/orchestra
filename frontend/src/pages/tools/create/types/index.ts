export interface AgentDetails {
  name: string;
  description: string;
}

export type GenerateMode = 'replace' | 'alter';

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export interface PayloadData {
  system: string;
  [key: string]: any;
} 