import { DEFAULT_SYSTEM_PROMPT } from "@/config/instruction";
import { ThreadPayload } from "@/entities";



export function constructSystemPrompt(systemPrompt: string) {
  return `${systemPrompt}
---
Current Date and Time: ${new Date().toLocaleString()}
Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
Language: ${navigator.language}
`;
}

export const constructPayload = (payload: ThreadPayload, agentId?: string) => {
	return agentId ? {
		query: payload.query,
	} : {
		...payload,
		// collection: {
		// 	id: "c904646f-c872-43ba-96d6-05492efc6015",
		// 	limit: 10,
		// 	filter: {}
		// },
		system: payload.system ? constructSystemPrompt(payload.system) : DEFAULT_SYSTEM_PROMPT
	}
}