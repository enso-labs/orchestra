
export enum ModelName {
    OPENAI_GPT_4O = "openai:gpt-4o",
    OPENAI_GPT_4O_MINI = "openai:gpt-4o-mini",
    OPENAI_REASONING_O1 = "openai:o1",
    OPENAI_REASONING_O1_MINI = "openai:o1-mini",
    OPENAI_REASONING_O3_MINI = "openai:o3-mini",
    OPENAI_EMBEDDING_LARGE = "openai:text-embedding-3-large",
    ANTHROPIC_CLAUDE_3_5_SONNET = "anthropic:claude-3-5-sonnet-20240620",
    ANTHROPIC_CLAUDE_3_7_SONNET_LATEST = "anthropic:claude-3-7-sonnet-latest",
    OLLAMA_LLAMA_3_2_VISION = "ollama:llama3.2-vision",
    OLLAMA_DEEPSEEK_R1_8B = "ollama:deepseek-r1:8b",
    OLLAMA_DEEPSEEK_R1_14B = "ollama:deepseek-r1:14b",
    GROQ_DEEPSEEK_R1_DISTILL_LLAMA_70B = "groq:deepseek-r1-distill-llama-70b",
    GROQ_LLAMA_3_3_70B_VERSATILE = "groq:llama-3.3-70b-versatile",
    GROQ_LLAMA_3_3_70B_SPECDEC = "groq:llama-3.3-70b-specdec",
    GROQ_LLAMA_3_2_90B_VISION = "groq:llama-3.2-90b-vision-preview",
    GEMINI_PRO_1_5 = "google_genai:gemini-1.5-pro",
    GEMINI_PRO_2 = "google_genai:gemini-2-pro"
}

export default ModelName;

export const DEFAULT_CHAT_MODEL = ModelName.OPENAI_GPT_4O_MINI;
export const DEFAULT_OPTIMIZE_MODEL = ModelName.OPENAI_GPT_4O;


// Helper to check if a model is valid
export function isValidModelName(model: string | null): boolean {
    return !!model && Object.values(ModelName).includes(model as ModelName);
}