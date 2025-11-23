import { formatContent, isEmpty } from "./format";

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
export class StreamMessageHandler {
	public toolNameRef: React.MutableRefObject<string>;
	public toolCallChunkRef: React.MutableRefObject<string>;
	public history: any;

	constructor(
		toolNameRef: React.MutableRefObject<string>,
		toolCallChunkRef: React.MutableRefObject<string>,
		history: any,
	) {
		this.toolNameRef = toolNameRef;
		this.toolCallChunkRef = toolCallChunkRef;
		this.history = history;
	}

	public toolCall(response: any) {
		const existingIndex = this.history.findIndex(
			(msg: any) => msg.id === response.id,
		);
		// Only set tool name if we don't have one yet or if the new name is truthy
		if (!this.toolNameRef.current || response.tool_call_chunks[0].name) {
			this.toolNameRef.current = response.tool_call_chunks[0].name;
		}
		this.toolCallChunkRef.current += response.tool_call_chunks[0].args;
		// If the message already exists, update it
		if (existingIndex !== -1) {
			// Consolidate tool_call_chunks for the message with matching id
			const existingMsg = this.history[existingIndex];
			if (this.toolCallChunkRef.current) {
				try {
					existingMsg.input = JSON.parse(this.toolCallChunkRef.current);
				} catch {
					try {
						const autoAddCommas =
							"[" +
							this.toolCallChunkRef.current.replace(/}\s*{/g, "},{") +
							"]";
						existingMsg.input = JSON.parse(autoAddCommas);
					} catch {
						existingMsg.input = this.toolCallChunkRef.current;
					}
				}
			}
			this.history[existingIndex] = {
				...existingMsg,
				...response,
			};
		} else {
			this.history.push({
				...response,
				input: this.toolCallChunkRef.current,
				name: this.toolNameRef.current,
			});
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
		};
	}

	public streamStop(response: any) {
		return (
			["stop", "end_turn", "STOP"].includes(
				response.response_metadata?.finish_reason ||
					response.response_metadata.stop_reason,
			) && response.tool_calls?.length === 0
		);
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
