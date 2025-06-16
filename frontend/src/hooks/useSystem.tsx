import { useChatContext } from "@/context/ChatContext"
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/config/instruction";
import { getSystemPrompt, setSystemPrompt } from "@/lib/utils/storage";
import { useEffect } from "react"

export function useSystem() {
  const { payload, setPayload } = useChatContext();

  useEffect(() => {
    // Initialize model from localStorage on mount
    const system = getSystemPrompt();
    if (system) {
      setPayload((prev: any) => ({ ...prev, system }));
    }
  }, []);

  useEffect(() => {
    // Update localStorage whenever payload.model changes
    if (typeof payload.system === 'string') {
      setSystemPrompt(payload.system);
    }
  }, [payload.system]);

  return typeof payload.system === 'string' ? payload.system : DEFAULT_SYSTEM_PROMPT;
}
