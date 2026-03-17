import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
	role: "user" | "assistant";
	content: string;
}

interface EmbedWidgetProps {
	agentId: string;
	apiBase: string;
	token?: string;
}

const STORAGE_KEY_PREFIX = "orchestra_embed_thread_";

/** Extract text from AIMessageChunk content (string or content-block array). */
function extractTextContent(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.filter(
				(b: Record<string, unknown>) =>
					b?.type === "text" && typeof b?.text === "string",
			)
			.map((b: Record<string, unknown>) => b.text)
			.join("");
	}
	return "";
}

export function EmbedWidget({ agentId, apiBase, token }: EmbedWidgetProps) {
	const [open, setOpen] = useState(false);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [streaming, setStreaming] = useState(false);
	const [threadId, setThreadId] = useState<string | null>(() => {
		try {
			return localStorage.getItem(`${STORAGE_KEY_PREFIX}${agentId}`);
		} catch {
			return null;
		}
	});

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const abortRef = useRef<AbortController | null>(null);

	// Auto-scroll on new messages
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// Focus input when panel opens
	useEffect(() => {
		if (open) {
			setTimeout(() => inputRef.current?.focus(), 100);
		}
	}, [open]);

	const saveThreadId = useCallback(
		(id: string) => {
			setThreadId(id);
			try {
				localStorage.setItem(`${STORAGE_KEY_PREFIX}${agentId}`, id);
			} catch {
				// localStorage unavailable
			}
		},
		[agentId],
	);

	const sendMessage = useCallback(async () => {
		const trimmed = input.trim();
		if (!trimmed || streaming) return;

		setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
		setInput("");
		setStreaming(true);
		setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

		const controller = new AbortController();
		abortRef.current = controller;

		try {
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};
			if (token) {
				headers["Authorization"] = `Bearer ${token}`;
			}

			const response = await fetch(
				`${apiBase}/api/assistants/public/${agentId}/embed-chat`,
				{
					method: "POST",
					headers,
					body: JSON.stringify({
						message: trimmed,
						thread_id: threadId,
					}),
					signal: controller.signal,
				},
			);

			if (!response.ok) {
				let detail = `Error: ${response.status}`;
				try {
					const errBody = await response.json();
					detail = errBody.detail || detail;
				} catch {
					// use default
				}
				setMessages((prev) => {
					const copy = [...prev];
					copy[copy.length - 1] = {
						role: "assistant",
						content: detail,
					};
					return copy;
				});
				return;
			}

			// Capture thread_id from response header
			const headerThreadId = response.headers.get("X-Thread-Id");
			if (headerThreadId) {
				saveThreadId(headerThreadId);
			}

			const reader = response.body?.getReader();
			if (!reader) return;

			const decoder = new TextDecoder();
			let buffer = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					if (!line.startsWith("data: ")) continue;
					const data = line.slice(6).trim();
					if (data === "[DONE]") continue;

					try {
						const parsed = JSON.parse(data);
						if (!Array.isArray(parsed) || parsed.length < 2) continue;

						const [eventType, payload] = parsed;

						if (eventType === "metadata" && payload?.thread_id) {
							saveThreadId(payload.thread_id);
						}

						if (eventType === "messages" && Array.isArray(payload)) {
							const msgDict = payload[0];
							if (msgDict && msgDict.content !== undefined) {
								const text = extractTextContent(msgDict.content);
								if (text) {
									setMessages((prev) => {
										const copy = [...prev];
										const last = copy[copy.length - 1];
										if (last?.role === "assistant") {
											copy[copy.length - 1] = {
												...last,
												content: last.content + text,
											};
										}
										return copy;
									});
								}
							}
						}

						if (eventType === "error") {
							const errMsg =
								typeof payload === "string"
									? payload
									: payload?.error || "An error occurred";
							setMessages((prev) => {
								const copy = [...prev];
								const last = copy[copy.length - 1];
								if (last?.role === "assistant" && !last.content) {
									copy[copy.length - 1] = {
										role: "assistant",
										content: errMsg,
									};
								}
								return copy;
							});
						}
					} catch {
						// skip unparseable lines
					}
				}
			}
		} catch (err: unknown) {
			if (err instanceof Error && err.name !== "AbortError") {
				setMessages((prev) => {
					const copy = [...prev];
					const last = copy[copy.length - 1];
					if (last?.role === "assistant" && !last.content) {
						copy[copy.length - 1] = {
							role: "assistant",
							content: "Failed to get response. Please try again.",
						};
					}
					return copy;
				});
			}
		} finally {
			setStreaming(false);
			abortRef.current = null;
		}
	}, [input, streaming, agentId, apiBase, token, threadId, saveThreadId]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	};

	return (
		<div
			style={{
				position: "fixed",
				bottom: "20px",
				right: "20px",
				zIndex: 2147483647,
				fontFamily: "system-ui, -apple-system, sans-serif",
			}}
		>
			{open && (
				<div
					style={{
						width: "380px",
						height: "520px",
						marginBottom: "12px",
						borderRadius: "12px",
						background: "#fff",
						boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
						display: "flex",
						flexDirection: "column",
						overflow: "hidden",
						border: "1px solid #e5e7eb",
					}}
				>
					{/* Header */}
					<div
						style={{
							padding: "14px 16px",
							background: "#111",
							color: "#fff",
							fontSize: "14px",
							fontWeight: 600,
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							flexShrink: 0,
						}}
					>
						<span>Chat</span>
						<button
							onClick={() => setOpen(false)}
							style={{
								background: "none",
								border: "none",
								color: "#fff",
								cursor: "pointer",
								fontSize: "18px",
								padding: "0 4px",
								lineHeight: 1,
							}}
						>
							&#x2715;
						</button>
					</div>

					{/* Messages */}
					<div
						style={{
							flex: 1,
							overflowY: "auto",
							padding: "12px",
							display: "flex",
							flexDirection: "column",
							gap: "8px",
						}}
					>
						{messages.length === 0 && (
							<div
								style={{
									flex: 1,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									color: "#9ca3af",
									fontSize: "13px",
									textAlign: "center",
									padding: "20px",
								}}
							>
								Send a message to start chatting
							</div>
						)}
						{messages.map((msg, i) => (
							<div
								key={i}
								style={{
									display: "flex",
									justifyContent:
										msg.role === "user" ? "flex-end" : "flex-start",
								}}
							>
								<div
									style={{
										maxWidth: "80%",
										padding: "8px 12px",
										borderRadius:
											msg.role === "user"
												? "12px 12px 2px 12px"
												: "12px 12px 12px 2px",
										background: msg.role === "user" ? "#111" : "#f3f4f6",
										color: msg.role === "user" ? "#fff" : "#111",
										fontSize: "13px",
										lineHeight: "1.5",
										wordBreak: "break-word",
										whiteSpace: "pre-wrap",
									}}
								>
									{msg.content ||
										(streaming && i === messages.length - 1 ? (
											<span style={{ color: "#9ca3af" }}>&#x2026;</span>
										) : null)}
								</div>
							</div>
						))}
						<div ref={messagesEndRef} />
					</div>

					{/* Input */}
					<div
						style={{
							padding: "10px 12px",
							borderTop: "1px solid #e5e7eb",
							display: "flex",
							gap: "8px",
							flexShrink: 0,
						}}
					>
						<input
							ref={inputRef}
							type="text"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Type a message..."
							disabled={streaming}
							style={{
								flex: 1,
								padding: "8px 12px",
								borderRadius: "8px",
								border: "1px solid #e5e7eb",
								fontSize: "13px",
								outline: "none",
								background: streaming ? "#f9fafb" : "#fff",
								color: "#111",
								fontFamily: "inherit",
							}}
						/>
						<button
							onClick={sendMessage}
							disabled={streaming || !input.trim()}
							style={{
								padding: "8px 14px",
								borderRadius: "8px",
								border: "none",
								background: streaming || !input.trim() ? "#d1d5db" : "#111",
								color: "#fff",
								cursor: streaming || !input.trim() ? "default" : "pointer",
								fontSize: "13px",
								fontWeight: 500,
								fontFamily: "inherit",
								flexShrink: 0,
							}}
						>
							Send
						</button>
					</div>

					{/* Footer */}
					<div
						style={{
							padding: "6px 12px",
							textAlign: "center",
							fontSize: "11px",
							color: "#9ca3af",
							borderTop: "1px solid #e5e7eb",
							flexShrink: 0,
						}}
					>
						Powered by{" "}
						<a
							href={`${apiBase}/a/${agentId}`}
							target="_blank"
							rel="noopener noreferrer"
							style={{
								color: "#6b7280",
								textDecoration: "underline",
							}}
						>
							Orchestra
						</a>
					</div>
				</div>
			)}

			{/* Floating button */}
			<button
				onClick={() => setOpen(!open)}
				aria-label={open ? "Close chat" : "Open chat"}
				style={{
					width: "56px",
					height: "56px",
					borderRadius: "50%",
					background: "#111",
					color: "#fff",
					border: "none",
					cursor: "pointer",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
					fontSize: "24px",
					marginLeft: "auto",
				}}
			>
				{open ? "\u2715" : "\uD83D\uDCAC"}
			</button>
		</div>
	);
}
