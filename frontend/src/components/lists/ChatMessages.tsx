import { useEffect, useRef, useCallback, memo, useState } from "react";
import { Loader2, Edit, Check, X, AlertTriangle } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { useAppContext } from "@/context/AppContext";
import { useChatContext } from "@/context/ChatContext";
import MarkdownCard from "../cards/MarkdownCard";
import DefaultTool from "../tools/Default";
import { formatContent } from "@/lib/utils/format";
import CopyTextButton from "../buttons/CopyTextButton";
import { latestHumanMessage } from "@/lib/utils/message";
import ToolTimeline from "../timeline/ToolTimeline";
import TextSelectionPopover from "../popovers/TextSelectionPopover";
import { SubagentBadge } from "../badges/SubagentBadge";
import type { RunError } from "@/hooks/useChat";

export const Message = memo(
	function Message({
		message,
		isLatest = false,
		messages,
		streamingRate,
		handleSubmit,
		loading,
		ttft,
		displayModel,
	}: {
		message: any;
		isLatest?: boolean;
		messages: any[];
		streamingRate?: { rate: number; count: number } | null;
		handleSubmit: (content: string) => Promise<void>;
		loading: boolean;
		ttft?: number | null;
		displayModel?: string | null;
	}) {
		const ICON_SIZE = 4;
		const [isEditing, setIsEditing] = useState(false);
		const [isEditingText, setIsEditingText] = useState(false);
		const [editedContent, setEditedContent] = useState("");
		const textareaRef = useRef<HTMLTextAreaElement>(null);

		// Auto-resize textarea
		const handleTextareaChange = (
			e: React.ChangeEvent<HTMLTextAreaElement>,
		) => {
			setEditedContent(e.target.value);
			// Auto-resize
			e.target.style.height = "auto";
			e.target.style.height = `${e.target.scrollHeight}px`;
		};

		// Handle edit mode activation
		const handleEditClick = (e: React.MouseEvent) => {
			e.stopPropagation();
			setIsEditingText(true);
			setEditedContent(formatContent(message.content));
			// Focus textarea after state update
			setTimeout(() => {
				if (textareaRef.current) {
					textareaRef.current.focus();
					textareaRef.current.style.height = "auto";
					textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
				}
			}, 0);
		};

		// Handle save
		const handleSave = async (e: React.MouseEvent) => {
			e.stopPropagation();
			// TODO: Implement save functionality to persist edited message
			console.log("Saving edited message:", editedContent);
			await handleSubmit(editedContent);
			setIsEditingText(false);
			setIsEditing(false);
		};

		// Handle cancel
		const handleCancel = (e: React.MouseEvent) => {
			e.stopPropagation();
			setIsEditingText(false);
			setEditedContent("");
		};

		// Handle keyboard shortcuts
		const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSave(e as any);
			} else if (e.key === "Escape") {
				e.preventDefault();
				handleCancel(e as any);
			}
		};

		if (["human", "user"].includes(message.type ?? message.role)) {
			return (
				<div key={message.id} className="p-2 rounded-md justify-end">
					<div className="flex justify-end">
						<div
							className={`max-w-[80%] md:max-w-[70%] bg-primary/90 text-primary-foreground px-4 rounded-xl rounded-br-sm relative ${
								isEditingText ? "pb-8" : isEditing ? "pb-5" : "py-0"
							} ${!isEditingText ? "cursor-pointer" : ""}`}
							onClick={() => !isEditingText && setIsEditing(!isEditing)}
						>
							{isEditingText ? (
								<textarea
									ref={textareaRef}
									value={editedContent}
									onChange={handleTextareaChange}
									onKeyDown={handleKeyDown}
									onClick={(e) => e.stopPropagation()}
									className="w-full resize-none overflow-y-auto min-h-[48px] max-h-[200px] py-2 bg-transparent text-primary-foreground focus:outline-none rounded-lg"
									rows={1}
								/>
							) : (
								<div className="py-2 whitespace-pre-wrap break-words">
									{formatContent(message.content)}
								</div>
							)}
							{isEditing && !isEditingText && (
								<div className="flex absolute bottom-1 right-1">
									<CopyTextButton text={formatContent(message.content)} />
									<button
										className="p-1 rounded hover:bg-muted transition-colors"
										onClick={handleEditClick}
									>
										<Edit
											className={`h-${ICON_SIZE} w-${ICON_SIZE} hover:text-foreground`}
										/>
									</button>
								</div>
							)}
							{isEditingText && (
								<div className="flex gap-1 absolute bottom-1 right-1">
									<button
										className="p-1 rounded hover:bg-green-500/20 transition-colors"
										onClick={handleSave}
										title="Save (Enter)"
									>
										<Check
											className={`h-${ICON_SIZE} w-${ICON_SIZE} text-green-500 hover:text-green-400`}
										/>
									</button>
									<button
										className="p-1 rounded hover:bg-red-500/20 transition-colors"
										onClick={handleCancel}
										title="Cancel (Esc)"
									>
										<X
											className={`h-${ICON_SIZE} w-${ICON_SIZE} text-red-500 hover:text-red-400`}
										/>
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			);
		}

		// Render individual tool_input messages (one per tool call)
		if (["tool_input"].includes(message.type ?? message.role)) {
			return (
				<div className="group px-3 md:px-5">
					<div className="max-w-[90vw] md:max-w-[80%] px-2 rounded-lg rounded-bl-sm">
						{message.name && (
							<span className="text-xs text-muted-foreground font-medium">
								{message.name}
							</span>
						)}
						<DefaultTool selectedToolMessage={message} collapsed={false} />
						{message.tool_call_id && (
							<span className="text-[10px] text-muted-foreground/60 font-mono block mt-0.5">
								{message.tool_call_id}
							</span>
						)}
					</div>
				</div>
			);
		}

		if (["tool"].includes(message.type ?? message.role)) {
			return (
				<div className="group px-3 md:px-5">
					<div className="max-w-[90vw] md:max-w-[80%] rounded-lg rounded-bl-sm m-2">
						<ToolTimeline messages={[message]} />
					</div>
				</div>
			);
		}

		const isSubagent = !!message.agent_name;
		const content = formatContent(message.content);

		// Nothing renderable — e.g. a reasoning-only block list, or an assistant
		// turn that carried only tool calls. Skip the bubble entirely.
		if (!content) return null;

		return (
			<div className="group px-3 md:px-5">
				<div
					className={`max-w-[90vw] md:max-w-[80%] rounded-lg rounded-bl-sm ${isSubagent ? "border-l-2 border-muted-foreground/20 pl-2" : ""}`}
				>
					{isSubagent && (
						<div className="mb-1">
							<SubagentBadge name={message.agent_name} />
						</div>
					)}
					<div className="bg-transparent text-foreground-500 px-3 rounded-lg rounded-bl-sm">
						<MarkdownCard content={content} />
					</div>
				</div>
				<div className="flex justify-start opacity-100 transition-opacity duration-200 mt-1 px-3">
					<div className="flex gap-1">
						<CopyTextButton text={content} />

						<div className="flex items-center gap-2">
							<button className="text-sm text-muted-foreground">
								{message.model ||
									latestHumanMessage(messages)?.model ||
									displayModel ||
									"Unknown model"}
							</button>

							{isLatest && streamingRate?.rate && (
								<span
									className={`text-sm text-muted-foreground/70 ${loading ? "animate-pulse" : ""}`}
								>
									{ttft != null && `TTFT: ${(ttft / 1000).toFixed(2)}s • `}
									{streamingRate.rate} tok/s • {streamingRate.count} tokens
								</span>
							)}
						</div>
					</div>
				</div>
			</div>
		);
	},
	(prevProps, nextProps) => {
		// Custom comparison: only re-render if relevant props changed
		return (
			prevProps.message === nextProps.message &&
			prevProps.isLatest === nextProps.isLatest &&
			prevProps.messages.length === nextProps.messages.length &&
			prevProps.loading === nextProps.loading &&
			prevProps.streamingRate === nextProps.streamingRate &&
			prevProps.ttft === nextProps.ttft &&
			prevProps.displayModel === nextProps.displayModel
		);
	},
);

// Persistent error surface for failed runs. Rendered inline in the chat
// message area (not a toast) so it survives until the user submits a fresh
// request. Aegra's run identifier remains available for support diagnostics.
function RunErrorBanner({ runError }: { runError: RunError }) {
	return (
		<div className="flex justify-start p-3 max-w-4xl mx-auto px-5 w-full">
			<div
				data-testid="message-error"
				role="alert"
				aria-live="assertive"
				className="flex w-full max-w-[90vw] md:max-w-[80%] flex-col gap-2 rounded-lg border border-destructive-accent/70 bg-destructive/10 px-4 py-3 text-sm text-foreground"
			>
				<div className="flex items-start gap-2">
					<AlertTriangle
						aria-hidden="true"
						className="h-4 w-4 mt-0.5 shrink-0 text-destructive-accent"
					/>
					<div className="flex-1">
						<p className="font-medium">The request failed.</p>
						<p className="break-words">
							{runError.message || "An unexpected error occurred."}
						</p>
						{runError.runId ? (
							<p
								data-testid="correlation-id"
								data-correlation-id={runError.runId}
								className="mt-1 font-mono text-xs text-foreground break-all"
							>
								Request ID: {runError.runId}
							</p>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}

const ChatMessages = memo(({ messages }: { messages: any[] }) => {
	const { loading, loadingMessage } = useAppContext();
	const {
		streamingRate,
		handleSubmit,
		ttft,
		submitStartTime,
		appendToQuery,
		displayModel,
		runError,
		streamStatus,
	} = useChatContext();
	const [elapsedTime, setElapsedTime] = useState<number | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const messagesContainerRef = useRef<HTMLDivElement>(null);

	// Live timer for TTFT while waiting for first token
	useEffect(() => {
		if (submitStartTime !== null && ttft === null) {
			const interval = setInterval(() => {
				setElapsedTime(Date.now() - submitStartTime);
			}, 100);
			return () => clearInterval(interval);
		} else {
			setElapsedTime(null);
		}
	}, [submitStartTime, ttft]);
	const isAtBottomRef = useRef(true);
	const rafIdRef = useRef<number | null>(null);
	const lastScrollHeightRef = useRef(0);

	// Memoize virtualizer options to prevent recreation
	const getScrollElement = useCallback(() => scrollRef.current, []);
	const estimateSize = useCallback(() => 100, []);

	// Virtualizer setup
	const virtualizer = useVirtualizer({
		count: messages.length,
		getScrollElement,
		estimateSize,
		overscan: 5,
	});

	// Check if user is at bottom of scroll (uses ref to avoid state updates during scroll)
	const checkIsAtBottom = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return true;
		// Use a threshold of 100px to account for dynamic content loading
		return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
	}, []);

	// Scroll to bottom instantly (no smooth behavior to avoid jitter)
	const scrollToBottom = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTo({
			top: el.scrollHeight,
			behavior: "instant" as ScrollBehavior,
		});
	}, []);

	// Handle scroll events - update ref directly, debounce state if needed
	const handleScroll = useCallback(() => {
		isAtBottomRef.current = checkIsAtBottom();
	}, [checkIsAtBottom]);

	// Scroll to bottom when new messages arrive (if user was at bottom)
	useEffect(() => {
		if (isAtBottomRef.current && messages.length > 0) {
			// Use RAF for smoother initial scroll
			requestAnimationFrame(() => {
				scrollToBottom();
			});
		}
	}, [messages.length, scrollToBottom]);

	// RAF-based auto-scroll during streaming (replaces interval-based approach)
	useEffect(() => {
		if (!loading || messages.length === 0) {
			// Clean up any pending RAF when not loading
			if (rafIdRef.current) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
			return;
		}

		const scrollLoop = () => {
			const el = scrollRef.current;
			if (!el || !loading) return;

			// Only scroll if user is at bottom and content height changed
			const currentScrollHeight = el.scrollHeight;
			if (
				isAtBottomRef.current &&
				currentScrollHeight !== lastScrollHeightRef.current
			) {
				lastScrollHeightRef.current = currentScrollHeight;
				el.scrollTo({
					top: currentScrollHeight,
					behavior: "instant" as ScrollBehavior,
				});
			}

			// Continue the loop while loading
			rafIdRef.current = requestAnimationFrame(scrollLoop);
		};

		// Start the RAF loop
		rafIdRef.current = requestAnimationFrame(scrollLoop);

		return () => {
			if (rafIdRef.current) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
		};
	}, [loading, messages.length]);

	if (messages.length === 0) {
		return (
			<div className="flex flex-col justify-center items-center h-full">
				{runError ? (
					<div className="w-full">
						<RunErrorBanner runError={runError} />
					</div>
				) : streamStatus ? (
					<div
						role="status"
						aria-live="polite"
						className="p-4 text-center text-muted-foreground"
					>
						{streamStatus}
					</div>
				) : (
					<p className="text-muted-foreground">No messages yet</p>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full min-h-0 overflow-hidden">
			<div
				ref={scrollRef}
				onScroll={handleScroll}
				className="flex-1 overflow-auto p-1 pb-8"
			>
				<div
					ref={messagesContainerRef}
					className="max-w-4xl mx-auto px-5 relative"
					style={{ height: `${virtualizer.getTotalSize()}px` }}
				>
					<TextSelectionPopover
						containerRef={messagesContainerRef}
						onAddToInput={appendToQuery}
					/>
					{virtualizer.getVirtualItems().map((virtualRow) => {
						const message = messages[virtualRow.index];
						if (message.type === "ai") {
							// Go backwards to find the nearest previous human message
							for (let i = virtualRow.index - 1; i >= 0; i--) {
								const prevMessage = messages[i];
								if (prevMessage && prevMessage.type === "human") {
									// Attach human's model to this AI message
									message.model = prevMessage.model;
									break;
								}
							}
						}
						return (
							<div
								key={message.id}
								data-index={virtualRow.index}
								ref={virtualizer.measureElement}
								className="absolute top-0 left-0 w-full"
								style={{ transform: `translateY(${virtualRow.start}px)` }}
							>
								<Message
									message={message}
									isLatest={virtualRow.index === messages.length - 1}
									messages={messages}
									streamingRate={streamingRate}
									handleSubmit={handleSubmit}
									loading={loading}
									ttft={ttft}
									displayModel={displayModel}
								/>
							</div>
						);
					})}
				</div>
				{loading && (
					<div
						role="status"
						aria-live="polite"
						className="flex justify-start p-3 max-w-4xl mx-auto px-5"
					>
						<Loader2 className="h-5 w-5 animate-spin mx-2" />
						<span className="text-muted-foreground">{loadingMessage}</span>
						{(elapsedTime !== null || ttft !== null) && (
							<span className="text-sm text-muted-foreground/70 ml-2">
								• TTFT: {((ttft ?? elapsedTime ?? 0) / 1000).toFixed(2)}s
							</span>
						)}
					</div>
				)}
				{runError && !loading && <RunErrorBanner runError={runError} />}
			</div>
		</div>
	);
});

ChatMessages.displayName = "ChatMessages";
export default ChatMessages;
