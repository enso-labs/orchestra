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
	return messages.map((message: any) => {
		// Spread preserves agent_name for subagent attribution (set by backend from lc_agent_name)
		let messageCopy = { ...message };
		// User Message
		if (["user", "human"].includes(message.type)) {
			messageCopy = {
				...messageCopy,
				role: "user",
			};
		}

		// Input Message - handle both string and object args
		if (
			["assistant", "ai"].includes(message.type) &&
			message.tool_calls?.length
		) {
			try {
				const input = message.tool_calls
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
								// If parsing fails, wrap in object
								return { raw: args };
							}
						}
						return { ...args };
					});
				// Only add input if we have valid tool calls
				if (input.length > 0) {
					messageCopy = {
						...messageCopy,
						type: "AIMessageChunk",
						role: "AIMessageChunk",
						input,
					};
				} else {
					// No valid tool calls, treat as regular assistant message
					messageCopy = {
						...messageCopy,
						role: "assistant",
					};
				}
			} catch (error) {
				console.warn(
					"Error formatting tool_calls for message:",
					message.id,
					error,
				);
				// Fallback to assistant message if formatting fails
				messageCopy = {
					...messageCopy,
					role: "assistant",
				};
			}
		}

		if (["tool"].includes(message.type)) {
			messageCopy = {
				...messageCopy,
				role: "tool",
			};
		}

		// Assistant Message
		if (
			["assistant", "ai"].includes(message.type) &&
			!message.tool_calls?.length
		) {
			messageCopy = {
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
	return content[0]?.text;
}

export function isEmpty(str: string) {
	return (
		str === null ||
		str === undefined ||
		(typeof str === "string" && str.trim().length === 0)
	);
}
