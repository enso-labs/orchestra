export function truncateFrom(
	input: string,
	position: "start" | "end" | "middle",
	replacement: string,
	len: number,
): string {
	if (input.length <= len) return input;

	const replacementLength = replacement.length;

	// Adjust length for the replacement text
	const allowedLength = len - replacementLength;

	if (allowedLength <= 0) {
		throw new Error("Replacement text is too long for the desired length.");
	}

	let startSliceEnd: number;
	let endSliceStart: number;

	switch (position) {
		case "start":
			startSliceEnd = 0;
			endSliceStart = input.length - allowedLength;
			break;
		case "end":
			startSliceEnd = allowedLength;
			endSliceStart = input.length;
			break;
		case "middle": {
			const half = Math.floor(allowedLength / 2);
			startSliceEnd = half;
			endSliceStart = input.length - (allowedLength - half);
			break;
		}
		default:
			throw new Error("Invalid position. Use 'start', 'end', or 'middle'.");
	}

	// Create the truncated string
	return (
		input.slice(0, startSliceEnd) + replacement + input.slice(endSliceStart)
	);
}

export function findToolCall(message: any, messages: any[]) {
	for (const msg of messages) {
		if (msg.tool_calls && msg.tool_calls.length > 0) {
			const toolCalls = msg.tool_calls;

			if (Array.isArray(toolCalls)) {
				// tool_calls is an array: iterate through each call
				for (const call of toolCalls) {
					if (call && typeof call === "object" && call.id === message.id) {
						delete message.tool_call_id;
						message.args = JSON.stringify(call.args);
						return message;
					}
				}
			} else if (typeof toolCalls === "object") {
				// tool_calls is a single object
				if (toolCalls.tool_call_id === message.id) {
					return toolCalls;
				}
			}
		}
	}
	return null;
}

export function constructSystemPrompt(systemPrompt: string) {
	return `${systemPrompt}
---
Current Date and Time: ${new Date().toLocaleString()}
Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
Language: ${navigator.language}
`;
}

export function base64Encode(str: string) {
	// Encode string as UTF-8, then to base64
	return btoa(encodeURIComponent(str));
}

export function base64Decode(str: string) {
	// Decode base64 string to UTF-8
	return decodeURIComponent(atob(str));
}

export function base64Compare(a: string, b: string) {
	return base64Encode(a) === base64Encode(b);
}

export function formatMessages(messages: any[]) {
	if (!messages || !Array.isArray(messages)) {
		return [];
	}
	return messages.flatMap((message: any) => {
		const messageCopy = { ...message };
		// User Message
		if (["user", "human"].includes(message.type)) {
			return {
				...messageCopy,
				role: "user",
			};
		}

		// Tool input messages — split each tool_call into its own tool_input message
		if (
			["assistant", "ai"].includes(message.type) &&
			message.tool_calls?.length
		) {
			const results: any[] = [];

			// If the AI message also has text content, emit it as an assistant message first
			const textContent = formatContent(message.content);
			if (textContent) {
				results.push({
					...messageCopy,
					role: "assistant",
					type: "assistant",
				});
			}

			try {
				const toolInputMessages = message.tool_calls
					.filter((tool_call: any) => {
						// Accept both objects and valid JSON strings
						if (tool_call.args && typeof tool_call.args === "object") {
							return true;
						}
						if (typeof tool_call.args === "string" && tool_call.args.trim()) {
							return true;
						}
						return false;
					})
					.map((tool_call: any) => {
						// Parse JSON string if necessary
						let args = tool_call.args;
						if (typeof args === "string") {
							try {
								args = JSON.parse(args);
							} catch {
								args = { raw: args };
							}
						}
						return {
							id: `${message.id}-tc-${tool_call.id}`,
							type: "tool_input",
							role: "tool_input",
							tool_call_id: tool_call.id,
							name: tool_call.name,
							input: args,
							parent_message_id: message.id,
							...(message.agent_name !== undefined && {
								agent_name: message.agent_name,
							}),
						};
					});

				if (toolInputMessages.length > 0) {
					results.push(...toolInputMessages);
				} else if (results.length === 0) {
					// No valid tool calls and no text content — fallback to assistant
					results.push({
						...messageCopy,
						role: "assistant",
					});
				}
			} catch (error) {
				console.warn(
					"Error formatting tool_calls for message:",
					message.id,
					error,
				);
				if (results.length === 0) {
					results.push({
						...messageCopy,
						role: "assistant",
					});
				}
			}
			return results;
		}

		// Already a tool_input message (from streaming) — pass through
		if (message.type === "tool_input") {
			return messageCopy;
		}

		if (["tool"].includes(message.type)) {
			return {
				...messageCopy,
				role: "tool",
			};
		}

		// Assistant Message (no tool calls)
		if (
			["assistant", "ai"].includes(message.type) &&
			!message.tool_calls?.length
		) {
			return {
				...messageCopy,
				role: "assistant",
			};
		}
		return messageCopy;
	});
}

export async function formatMultimodalPayload(
	query: string,
	images: File[] | string[],
) {
	const content: Array<
		| { type: "text"; text: string }
		| { type: "image_url"; image_url: { url: string; detail: string } }
	> = [{ type: "text", text: query }];

	if (images.length > 0) {
		for (const image of images) {
			if (image instanceof File) {
				// For File objects, convert to base64
				const arrayBuffer = await image.arrayBuffer();
				const bytes = new Uint8Array(arrayBuffer);
				let binary = "";
				for (let i = 0; i < bytes.byteLength; i++) {
					binary += String.fromCharCode(bytes[i]);
				}
				const base64Data = btoa(binary);

				// Determine MIME type
				const mimeType = image.type || "image/jpeg";

				content.push({
					type: "image_url",
					image_url: {
						url: `data:${mimeType};base64,${base64Data}`,
						detail: "auto",
					},
				});
			} else if (typeof image === "string") {
				// For URL strings, check if it's already base64 or needs fetching
				if (image.startsWith("data:")) {
					// Already a data URL, use as-is
					content.push({
						type: "image_url",
						image_url: {
							url: image,
							detail: "auto",
						},
					});
				} else {
					// External URL - fetch and convert to base64
					try {
						const response = await fetch(image);
						const blob = await response.blob();
						const arrayBuffer = await blob.arrayBuffer();
						const bytes = new Uint8Array(arrayBuffer);
						let binary = "";
						for (let i = 0; i < bytes.byteLength; i++) {
							binary += String.fromCharCode(bytes[i]);
						}
						const base64Data = btoa(binary);
						const mimeType = blob.type || "image/jpeg";

						content.push({
							type: "image_url",
							image_url: {
								url: `data:${mimeType};base64,${base64Data}`,
								detail: "auto",
							},
						});
					} catch (error) {
						// If fetching fails, fall back to using the URL directly
						console.error("Failed to fetch and encode image:", error);
						content.push({
							type: "image_url",
							image_url: {
								url: image,
								detail: "auto",
							},
						});
					}
				}
			}
		}
	}

	return [{ role: "user", content: content }];
}

export function formatContent(content: any) {
	if (typeof content === "string") {
		return content;
	}
	if (!content) return "";
	return content[0]?.text;
}

export function isEmpty(str: string) {
	return (
		str === null ||
		str === undefined ||
		(typeof str === "string" && str.trim().length === 0)
	);
}
