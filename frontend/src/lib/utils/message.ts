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


export class StreamMessageHandler {
	private messages: any[];
	private toolNameRef: React.MutableRefObject<string>;
	private toolCallChunkRef: React.MutableRefObject<string>;

	constructor(
		messages: any[],
		toolNameRef: React.MutableRefObject<string>,
		toolCallChunkRef: React.MutableRefObject<string>,
	) {
		this.messages = messages;
		this.toolNameRef = toolNameRef;
		this.toolCallChunkRef = toolCallChunkRef;
	}

	private messageIndex(response: any) {
		return this.messages.findIndex(
			(msg: any) => msg.id === response.id,
		);
	}

	private constructInput(index: any) {
		if (this.toolCallChunkRef.current) {
			try {
				this.messages[index].input = JSON.parse(this.toolCallChunkRef.current);
			} catch {
				try {
					const autoAddCommas =
						"[" + this.toolCallChunkRef.current.replace(/}\s*{/g, "},{") + "]";
					this.messages[index].input = JSON.parse(autoAddCommas);
				} catch {
					this.messages[index].input = this.toolCallChunkRef.current;
				}
			}
		}
	}

	private toolCall(response: any) {
		// Set Tool Name
		if (!this.toolNameRef.current || response.tool_call_chunks[0].name) {
			this.toolNameRef.current = response.tool_call_chunks[0].name;
		}
		this.toolCallChunkRef.current += response.tool_call_chunks[0].args;
		this.constructInput(this.messageIndex(response));
	}

	private updateMessages(response: any) {
		const existingIndex = this.messages.findIndex(
			(msg: any) => msg.id === response.id,
		);
		const content = formatContent(response.content);
		// Message does not exist, add it
		if (existingIndex === -1) {
			const message = {
				...response,
				content,
				name: isEmpty(this.toolNameRef.current) && undefined,
				input: isEmpty(this.toolCallChunkRef.current) && undefined,
			};
			this.messages.push(message);
		} else {
			// Message exists, update it
			const existingMsg = this.messages[existingIndex];
			this.messages[existingIndex] = {
				...existingMsg,
				...response,
				content: formatContent(existingMsg.content) + content,
			};
		}
	}

	public process(response: any) {
		// Does the message already exist?
		const toolCallChunks = response.tool_call_chunks;
		if (toolCallChunks && toolCallChunks.length > 0) {this.toolCall(response);}
		this.updateMessages(response);

		return {
			messages: this.messages,
			toolMessage: this.toolNameRef.current ? `Calling ${this.toolNameRef.current} tool...`: null,
		};
	}
}