import { formatContent, isEmpty } from "./format";


export function latestHumanMessage(messages: any[] | undefined | null) {
	if (!Array.isArray(messages) || messages.length === 0) {
		return null;
	}
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg && msg.type === "human") {
			return msg;
		}
	}
	return null;
}


interface Metric {
	count: number;
	startTime: number;
	rate: number | null;
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

	public toolCall(response: any, existingIndex: number) {
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
		return {
			history: this.history,
			toolMessage: `Calling ${this.toolNameRef.current} tool...`,
		};
	}

	public messageCreate(response: any, setStreamingRate: any) {
		const expectedContent = formatContent(response.content);
		const responseMetadata = response.response_metadata;
		// Initialize streaming rate for new message
		setStreamingRate({
			count: expectedContent.length,
			startTime: Date.now(),
			rate: null,
		});

		const updateMessage = {
			...response,
			content: expectedContent,
			role: response.type === "tool" ? "tool" : "assistant",
		};
		if (responseMetadata.ls_provider && responseMetadata.ls_model_name) {
			updateMessage.model = `${responseMetadata.ls_provider}:${responseMetadata.ls_model_name}`;
		}
		if (responseMetadata.ls_temperature) {
			updateMessage.temperature = responseMetadata.ls_temperature;
		}
		if (responseMetadata.thread_id) {
			updateMessage.thread_id = responseMetadata.thread_id;
		}
		if (responseMetadata.checkpoint_ns && responseMetadata.checkpoint_node) {
			updateMessage.checkpoint_ns = responseMetadata.checkpoint_ns;
		}
		this.history.push(updateMessage);
	}

	public messageUpdate(
		response: any,
		existingIndex: number,
		expectedContent: string,
		setStreamingRate: any,
	) {
		// Always append to the related message content
		const existingMsg = this.history[existingIndex];
		const updatedContent = formatContent(existingMsg.content) + expectedContent;

		// Track streaming rate
		setStreamingRate((prev: any) => {
			const now = Date.now();
			const startTime = prev?.startTime || now;
			const newCount = (prev?.count || 0) + expectedContent.length;
			const elapsed = (now - startTime) / 1000;

			return {
				count: newCount,
				startTime,
				rate: elapsed > 0.1 ? Math.round(newCount / elapsed / 4) : null,
			};
		});

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
}