import { formatContent } from "./format";

export function latestHumanMessage(messages: any[] | undefined | null) {
	if (!Array.isArray(messages) || messages.length === 0) {
		return null;
	}
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg && ["user", "human"].includes(msg.type)) {
			return msg;
		}
	}
	return null;
}

interface ToolCallState {
	name: string;
	args: string;
}

export class StreamMessageHandler {
	public toolNameRef: React.MutableRefObject<string>;
	public toolCallMapRef: React.MutableRefObject<Map<string, ToolCallState>>;
	public history: any;

	constructor(
		toolNameRef: React.MutableRefObject<string>,
		toolCallMapRef: React.MutableRefObject<Map<string, ToolCallState>>,
		history: any,
	) {
		this.toolNameRef = toolNameRef;
		this.toolCallMapRef = toolCallMapRef;
		this.history = history;
	}

	public toolCall(response: any) {
		// Process each tool_call_chunk independently
		for (const chunk of response.tool_call_chunks) {
			const tcId = chunk.id;
			if (!tcId) continue;

			// Get or create state for this tool_call_id
			let state = this.toolCallMapRef.current.get(tcId);
			if (!state) {
				state = { name: "", args: "" };
				this.toolCallMapRef.current.set(tcId, state);
			}

			// Update name if present (only sent on first chunk)
			if (chunk.name) {
				state.name = chunk.name;
			}

			// Accumulate args
			if (chunk.args) {
				state.args += chunk.args;
			}

			// Update the toolNameRef for the loading message
			if (state.name) {
				this.toolNameRef.current = state.name;
			}

			// Build a unique history entry id for this tool_call
			const entryId = `${response.id}-tc-${tcId}`;
			const existingIndex = this.history.findIndex(
				(msg: any) => msg.id === entryId,
			);

			// Parse accumulated args
			let parsedInput: any = state.args;
			if (state.args) {
				try {
					parsedInput = JSON.parse(state.args);
				} catch {
					// Args not yet complete JSON — keep as string
					parsedInput = state.args;
				}
			}

			const entry = {
				id: entryId,
				type: "tool_input",
				role: "tool_input",
				tool_call_id: tcId,
				name: state.name,
				input: parsedInput,
				parent_message_id: response.id,
			};

			if (existingIndex !== -1) {
				this.history[existingIndex] = entry;
			} else {
				this.history.push(entry);
			}
		}
	}

	public messageCreate(response: any, expectedContent: string) {
		const updateMessage = {
			...response,
			content: expectedContent,
		};
		this.history.push(updateMessage);
	}

	public messageUpdate(
		response: any,
		expectedContent: string,
		existingIndex: number,
	) {
		// Always append to the related message content
		const existingMsg = this.history[existingIndex];
		const updatedContent = formatContent(existingMsg.content) + expectedContent;

		this.history[existingIndex] = {
			...response,
			...existingMsg,
			content: updatedContent,
			// Preserve agent_name from first chunk (subagent attribution)
			agent_name: existingMsg.agent_name ?? response.agent_name ?? null,
		};
	}

	public streamStop(response: any) {
		const stopReason =
			["stop", "end_turn", "STOP"].includes(
				response.response_metadata?.finish_reason ||
					response.response_metadata.stop_reason,
			) && response.tool_calls?.length === 0;

		return stopReason;
	}

	public processResponse(
		response: any,
		expectedContent: string,
		existingIndex: number,
	) {
		// Handle Tool Input
		if (response.tool_call_chunks && response.tool_call_chunks.length > 0) {
			this.toolCall(response);
		}

		if (
			expectedContent &&
			(!response.tool_call_chunks || response.tool_call_chunks.length === 0)
		) {
			if (existingIndex === -1) {
				this.messageCreate(response, expectedContent);
			} else {
				this.messageUpdate(response, expectedContent, existingIndex);
			}
		}
	}
}
