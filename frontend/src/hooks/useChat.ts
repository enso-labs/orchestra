import { useCallback, useRef, useState } from "react";
import { useAppContext } from "@/context/AppContext";
import {
	formatContent,
	formatMultimodalPayload,
	formatMessages,
} from "@/lib/utils/format";
import {
	agentClient,
	adaptEvent,
	describeAgentError,
	mapAssistantToProductionGraph,
} from "@/lib/api/agentClient";
import { useAgentContext } from "@/context/AgentContext";
import { StreamMessageHandler } from "@/lib/utils/message";
import type { Todo } from "@/components/lists/TodoList";
import { getSettings } from "@/lib/services/userSettingsService";
import { useMountEffect } from "@/hooks/useMountEffect";

type StreamMode = "metadata" | "messages" | "values" | "custom" | "error";

export type RunError = {
	runId: string;
	message: string;
	recoverable: boolean;
};

type ActiveRun = {
	token: number;
	threadId: string;
	runId: string | null;
	controller: AbortController;
	cancelled: boolean;
	cancelPromise: Promise<void> | null;
};

export type ChatContextType = {
	responseRef: React.RefObject<string>;
	toolCallMapRef: React.RefObject<Map<string, { name: string; args: string }>>;
	query: string;
	setQuery: (query: string) => void;
	appendToQuery: (text: string) => void;
	inputRef: React.RefObject<HTMLTextAreaElement>;
	handleSubmit: (query?: string, images?: File[]) => Promise<void>;
	sseHandler: (
		payload: any,
		messages: any[],
		stream_mode?: StreamMode | Array<StreamMode>,
	) => void;
	clearContent: () => void;
	messages: any[];
	setMessages: (messages: any[]) => void;
	controller: AbortController | null;
	setController: (controller: AbortController | null) => void;
	metadata: { [key: string]: any };
	setMetadata: (metadata: any) => void;
	abortQuery: () => Promise<void>;
	deleteThread: (threadId: string) => Promise<boolean>;
	handleTextareaResize: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
	clearMessages: () => void;
	resetMetadata: () => void;
	arcade: { tools: string[]; toolkit: string[] };
	setArcade: (arcade: { tools: string[]; toolkit: string[] }) => void;
	streamingRate: {
		count: number;
		startTime: number;
		rate: number | null;
	} | null;
	filesMap: Map<string, any>;
	setFilesMap: (filesMap: Map<string, any>) => void;
	submissionFiles: Record<string, any> | null;
	setSubmissionFiles: (files: Record<string, any> | null) => void;
	todos: Todo[];
	setTodos: (todos: Todo[]) => void;
	viewMode: "chat" | "editor";
	setViewMode: (mode: "chat" | "editor") => void;
	ttft: number | null;
	submitStartTime: number | null;
	addFile: (path: string, content?: string) => void;
	updateFileContent: (path: string, content: string) => void;
	removeFile: (path: string) => void;
	renameFile: (oldPath: string, newPath: string) => void;
	getFilesForSubmission: () => Record<string, any>;
	runError: RunError | null;
	setRunError: (error: RunError | null) => void;
	streamStatus: string | null;
};

export default function useChat(): ChatContextType {
	const { setLoading, setLoadingMessage } = useAppContext();
	const { agent } = useAgentContext();
	const responseRef = useRef("");
	const toolNameRef = useRef("");
	const toolCallMapRef = useRef(
		new Map<string, { name: string; args: string }>(),
	);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const [query, setQuery] = useState("");
	const [messages, setMessagesState] = useState<any[]>([]);
	const messagesRef = useRef<any[]>([]);
	const setMessages = useCallback((newMessages: any[]) => {
		messagesRef.current = [...newMessages];
		setMessagesState(newMessages);
	}, []);

	const [metadata, setMetadataState] = useState<any>(() => {
		const storedProjectId = localStorage.getItem("current_project_id");
		return {
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			language: navigator.language,
			current_utc: undefined,
			...(storedProjectId ? { project_id: storedProjectId } : {}),
		};
	});
	const metadataRef = useRef<any>(metadata);
	metadataRef.current = metadata;
	const setMetadata = useCallback((next: any) => {
		setMetadataState((previous: any) => {
			const resolved = typeof next === "function" ? next(previous) : next;
			metadataRef.current = resolved;
			return resolved;
		});
	}, []);

	const [controller, setController] = useState<AbortController | null>(null);
	const activeRunRef = useRef<ActiveRun | null>(null);
	const runSequenceRef = useRef(0);
	const [runError, setRunError] = useState<RunError | null>(null);
	const [streamStatus, setStreamStatus] = useState<string | null>(null);
	const [streamingRate, setStreamingRate] = useState<{
		count: number;
		startTime: number;
		rate: number | null;
	} | null>(null);
	const [savedTimezone, setSavedTimezone] = useState<string | null>(null);

	useMountEffect(() => {
		getSettings()
			.then((res) => setSavedTimezone(res.defaults.timezone))
			.catch(() => undefined);
	});

	const [arcade, setArcade] = useState({
		tools: [] as string[],
		toolkit: [] as string[],
	});
	const [filesMap, setFilesMap] = useState<Map<string, any>>(new Map());
	const [submissionFiles, setSubmissionFilesState] = useState<Record<
		string,
		any
	> | null>(null);
	const [todos, setTodos] = useState<Todo[]>([]);
	const [viewMode, setViewMode] = useState<"chat" | "editor">("chat");
	const [ttft, setTtft] = useState<number | null>(null);
	const [submitStartTime, setSubmitStartTime] = useState<number | null>(null);
	const submitStartTimeRef = useRef<number | null>(null);

	const setSubmissionFiles = useCallback(
		(files: Record<string, any> | null) => {
			setSubmissionFilesState(files ? { ...files } : null);
		},
		[],
	);

	const collectFilesFromLegacyMap = useCallback((): Record<string, any> => {
		const result: Record<string, any> = {};
		filesMap.forEach((files) => Object.assign(result, files));
		return result;
	}, [filesMap]);

	const getResolvedSubmissionFiles = useCallback((): Record<string, any> => {
		return submissionFiles ?? collectFilesFromLegacyMap();
	}, [collectFilesFromLegacyMap, submissionFiles]);

	const clearContent = useCallback(() => {
		responseRef.current = "";
		toolCallMapRef.current.clear();
	}, []);

	const abortQuery = useCallback(async (): Promise<void> => {
		const activeRun = activeRunRef.current;
		if (!activeRun || activeRun.cancelled) return;

		// Stop local rendering first. The SDK request is then cancelled by its
		// run-scoped endpoint when Aegra has returned a run id; a late acknowledgement
		// is cancelled from the stream callback as well.
		activeRun.cancelled = true;
		activeRun.controller.abort();
		setController(null);
		setLoading(false);
		setLoadingMessage("");
		setStreamStatus("The request was stopped.");

		if (!activeRun.runId) {
			activeRunRef.current = null;
			return;
		}
		if (!activeRun.cancelPromise) {
			activeRun.cancelPromise = agentClient.runs
				.cancel(activeRun.threadId, activeRun.runId, false, "interrupt")
				.then(() => undefined)
				.catch(() => undefined);
		}
		await activeRun.cancelPromise;
		if (activeRunRef.current === activeRun) activeRunRef.current = null;
	}, [setLoading, setLoadingMessage]);

	const getMetadata = useCallback(() => {
		return {
			...metadataRef.current,
			assistant_id: agent.id,
			orchestra_assistant_id: agent.id,
			model: agent.model,
			system_prompt: agent.prompt ?? agent.system_prompt,
			tools: agent.tools,
			a2a: agent.a2a,
			mcp: agent.mcp,
			subagents: agent.subagents,
			current_utc: new Date().toISOString(),
			timezone:
				savedTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
			language: Intl.DateTimeFormat().resolvedOptions().locale,
		};
	}, [agent.id, savedTimezone]);

	const handleMessages = useCallback(
		(payload: any, history: any[]) => {
			if (!Array.isArray(payload) || payload.length < 2) return;
			const streamMode = payload[0] as StreamMode;
			const data = payload[1];

			if (streamMode === "error") {
				const errorPayload = data && typeof data === "object" ? data : {};
				const runId = String(
					errorPayload.run_id ?? metadataRef.current?.run_id ?? "",
				);
				setRunError({
					runId,
					message: String(
						errorPayload.error ?? errorPayload.message ?? "The run failed.",
					),
					recoverable: false,
				});
				setLoading(false);
				return;
			}

			if (streamMode === "metadata") {
				const metadataPayload = data && typeof data === "object" ? data : {};
				const activeRun = activeRunRef.current;
				if (activeRun && metadataPayload.run_id) {
					activeRun.runId = String(metadataPayload.run_id);
				}
				if (activeRun && metadataPayload.thread_id) {
					activeRun.threadId = String(metadataPayload.thread_id);
				}
				setMetadata((previous: any) => ({
					...previous,
					thread_id: metadataPayload.thread_id ?? previous.thread_id,
					run_id: metadataPayload.run_id ?? previous.run_id,
				}));
				return;
			}

			if (streamMode === "custom") {
				const custom = data && typeof data === "object" ? data : {};
				const customData =
					custom.data && typeof custom.data === "object" ? custom.data : custom;
				if (customData.files && typeof customData.files === "object") {
					const latestMessage = [...history]
						.reverse()
						.find((msg) =>
							["ai", "assistant", "tool"].includes(msg.type ?? msg.role),
						);
					if (latestMessage) {
						setFilesMap((previous) => {
							const next = new Map(previous);
							next.set(latestMessage.id, customData.files);
							return next;
						});
					}
				}
				if (Array.isArray(customData.todos)) setTodos(customData.todos);
				return;
			}

			if (streamMode === "values") {
				const valuesData = data && typeof data === "object" ? data : {};
				if (valuesData.files && Object.keys(valuesData.files).length > 0) {
					const latestMessage = [...history]
						.reverse()
						.find((msg) =>
							["ai", "assistant", "tool"].includes(msg.type ?? msg.role),
						);
					if (latestMessage) {
						setFilesMap((previous) => {
							const next = new Map(previous);
							next.set(latestMessage.id, valuesData.files);
							return next;
						});
					}
				}
				if (Array.isArray(valuesData.todos)) setTodos(valuesData.todos);
				return;
			}

			if (streamMode !== "messages" || !Array.isArray(data) || !data[0]) return;
			const response = data[0] as Record<string, any>;
			const responseMetadata =
				data[1] && typeof data[1] === "object" ? data[1] : {};
			if (response.agent_name === undefined) response.agent_name = null;
			if (responseMetadata.thread_id) {
				setMetadata((previous: any) => ({
					...previous,
					thread_id: responseMetadata.thread_id,
				}));
			}

			const expectedContent = formatContent(response.content);
			const existingIndex = history.findIndex(
				(msg: any) => msg.id === response.id,
			);
			if (existingIndex === -1 && submitStartTimeRef.current !== null) {
				setTtft(Date.now() - submitStartTimeRef.current);
				submitStartTimeRef.current = null;
				setSubmitStartTime(null);
			}

			if (expectedContent && !response.tool_call_chunks?.length) {
				if (existingIndex === -1) {
					setStreamingRate({
						count: expectedContent.length,
						startTime: Date.now(),
						rate: null,
					});
				} else {
					setStreamingRate((previous) => {
						const now = Date.now();
						const startTime = previous?.startTime || now;
						const count = (previous?.count || 0) + expectedContent.length;
						const elapsed = (now - startTime) / 1000;
						return {
							count,
							startTime,
							rate: elapsed > 0.1 ? Math.round(count / elapsed / 4) : null,
						};
					});
				}
			}

			const streamHandler = new StreamMessageHandler(
				toolNameRef,
				toolCallMapRef,
				history,
			);
			streamHandler.processResponse(response, expectedContent, existingIndex);
			setLoadingMessage(
				streamHandler.toolNameRef.current
					? `Calling ${streamHandler.toolNameRef.current} tool...`
					: "Generating response...",
			);
			const normalizedHistory = formatMessages(streamHandler.history);
			messagesRef.current = [...normalizedHistory];
			setMessagesState(normalizedHistory);
		},
		[setLoading, setLoadingMessage, setMetadata],
	);

	const sseHandler = useCallback(
		(payload: any, history: any[]) => handleMessages(payload, history),
		[handleMessages],
	);

	const handleSubmit = useCallback(
		async (argQuery?: string, images: File[] = []) => {
			const queryToSubmit = argQuery || query;
			if (!queryToSubmit.trim() && images.length === 0) return;
			if (activeRunRef.current) return;

			setLoading(true);
			setLoadingMessage("Request submitted...");
			setRunError(null);
			setStreamStatus("Streaming response...");
			setTtft(null);
			setStreamingRate(null);
			const startedAt = Date.now();
			submitStartTimeRef.current = startedAt;
			setSubmitStartTime(startedAt);

			const userMessage = {
				id: `user-${startedAt}`,
				model: agent.model,
				content: queryToSubmit,
				role: "user",
				type: "user",
			};
			setMessages([...messagesRef.current, userMessage]);
			clearContent();

			const controller = new AbortController();
			const activeRun: ActiveRun = {
				token: ++runSequenceRef.current,
				threadId: metadataRef.current?.thread_id ?? "",
				runId: null,
				controller,
				cancelled: false,
				cancelPromise: null,
			};
			activeRunRef.current = activeRun;
			setController(controller);

			try {
				const formattedMessages = await formatMultimodalPayload(
					queryToSubmit,
					images,
				);
				if (activeRun.cancelled || controller.signal.aborted) return;
				const mapping = mapAssistantToProductionGraph(agent, getMetadata());
				let threadId = activeRun.threadId;
				if (!threadId) {
					const created = await agentClient.threads.create({
						graphId: mapping.graphId,
						metadata: mapping.metadata,
						signal: controller.signal,
					});
					threadId = created.thread_id;
					activeRun.threadId = threadId;
					setMetadata((previous: any) => ({
						...previous,
						thread_id: threadId,
						assistant_id: agent.id,
					}));
				}
				if (activeRun.cancelled || controller.signal.aborted) return;

				const files = getResolvedSubmissionFiles();
				const runMetadata = {
					...mapping.metadata,
					thread_id: threadId,
					assistant_id: agent.id,
				};
				const runContext = {
					...mapping.context,
					thread_id: threadId,
				};
				const runConfig = {
					configurable: { ...mapping.config.configurable, thread_id: threadId },
				};
				const stream = agentClient.runs.stream(threadId, mapping.assistantId, {
					input: {
						messages: formattedMessages,
						...(Object.keys(files).length > 0 ? { files } : {}),
					},
					config: runConfig,
					context: runContext,
					metadata: runMetadata,
					streamMode: [...(["messages-tuple", "values", "custom"] as const)],
					streamSubgraphs: true,
					streamResumable: true,
					streamIdleReconnect: "auto",
					// Keep the run alive across transport loss; explicit user cancellation
					// calls the run-scoped SDK cancel endpoint below.
					onDisconnect: "continue",
					multitaskStrategy: "reject",
					signal: controller.signal,
					onRunCreated: ({ run_id, thread_id }) => {
						const runThreadId = thread_id ?? activeRun.threadId;
						if (
							activeRun.cancelled ||
							activeRunRef.current?.token !== activeRun.token
						) {
							// A run can be acknowledged after the user aborts the request.
							// Cancel that exact late-created run instead of leaking it.
							if (runThreadId && !activeRun.cancelPromise) {
								activeRun.cancelPromise = agentClient.runs
									.cancel(runThreadId, run_id, false, "interrupt")
									.then(() => undefined)
									.catch(() => undefined);
							}
							return;
						}
						activeRun.runId = run_id;
						if (thread_id) activeRun.threadId = thread_id;
						setMetadata((previous: any) => ({
							...previous,
							run_id,
							thread_id: thread_id ?? previous.thread_id,
						}));
					},
				});

				for await (const event of stream) {
					if (
						activeRun.cancelled ||
						activeRunRef.current?.token !== activeRun.token
					)
						break;
					const adapted = adaptEvent(event);
					if (adapted) {
						handleMessages([adapted.type, adapted.data], messagesRef.current);
					}
				}

				if (
					!activeRun.cancelled &&
					activeRunRef.current?.token === activeRun.token
				) {
					setStreamStatus(null);
				}
			} catch (error) {
				if (activeRun.cancelled || controller.signal.aborted) return;
				const described = describeAgentError(error);
				setRunError({
					runId: activeRun.runId ?? metadataRef.current?.run_id ?? "",
					message: described.message,
					recoverable: false,
				});
				setStreamStatus(null);
			} finally {
				if (activeRunRef.current?.token === activeRun.token) {
					activeRunRef.current = null;
					setController(null);
					setLoading(false);
					setLoadingMessage("");
				}
			}
			setQuery("");
		},
		[
			agent,
			clearContent,
			getMetadata,
			getResolvedSubmissionFiles,
			handleMessages,
			messagesRef,
			query,
			setLoading,
			setLoadingMessage,
			setMetadata,
		],
	);

	const resetMetadata = useCallback(() => setMetadata({}), [setMetadata]);

	const clearMessages = useCallback(() => {
		messagesRef.current = [];
		setMessagesState([]);
		resetMetadata();
		setFilesMap(new Map());
		setTodos([]);
		setViewMode("chat");
		setTtft(null);
		submitStartTimeRef.current = null;
		setSubmitStartTime(null);
		setStreamStatus(null);
	}, [resetMetadata]);

	const deleteThread = useCallback(async (threadId: string) => {
		await agentClient.threads.delete(threadId);
		return true;
	}, []);

	const handleTextareaResize = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			e.target.style.height = "auto";
			e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
			setQuery(e.target.value);
		},
		[],
	);

	const appendToQuery = useCallback((text: string) => {
		const quotedText = `> ${text}\n\n`;
		setQuery((previous) =>
			previous ? `${quotedText}${previous}` : quotedText,
		);
		setTimeout(() => {
			if (inputRef.current) {
				inputRef.current.focus();
				inputRef.current.setSelectionRange(
					quotedText.length,
					quotedText.length,
				);
			}
		}, 0);
	}, []);

	const addFile = useCallback((path: string, content = "") => {
		const now = new Date().toISOString();
		const newFile = {
			content: content.split("\n"),
			created_at: now,
			modified_at: now,
		};
		setFilesMap((previous) => {
			const next = new Map(previous);
			const userFiles = next.get("__user_files__") || {};
			next.set("__user_files__", { ...userFiles, [path]: newFile });
			return next;
		});
	}, []);

	const updateFileContent = useCallback((path: string, content: string) => {
		setFilesMap((previous) => {
			const next = new Map(previous);
			for (const [key, files] of next.entries()) {
				if (files?.[path]) {
					next.set(key, {
						...files,
						[path]: {
							...files[path],
							content: content.split("\n"),
							modified_at: new Date().toISOString(),
						},
					});
					return next;
				}
			}
			return next;
		});
	}, []);

	const removeFile = useCallback((path: string) => {
		setFilesMap((previous) => {
			const next = new Map(previous);
			for (const [key, files] of next.entries()) {
				if (files?.[path]) {
					const { [path]: _removed, ...rest } = files;
					if (Object.keys(rest).length === 0) next.delete(key);
					else next.set(key, rest);
					return next;
				}
			}
			return next;
		});
	}, []);

	const renameFile = useCallback((oldPath: string, newPath: string) => {
		setFilesMap((previous) => {
			const next = new Map(previous);
			for (const [key, files] of next.entries()) {
				if (files?.[oldPath]) {
					const { [oldPath]: fileData, ...rest } = files;
					next.set(key, {
						...rest,
						[newPath]: { ...fileData, modified_at: new Date().toISOString() },
					});
					return next;
				}
			}
			return next;
		});
	}, []);

	const getFilesForSubmission = useCallback(
		() => getResolvedSubmissionFiles(),
		[getResolvedSubmissionFiles],
	);

	return {
		responseRef,
		toolCallMapRef,
		handleSubmit,
		sseHandler,
		clearContent,
		query,
		setQuery,
		appendToQuery,
		inputRef,
		messages,
		setMessages,
		metadata,
		setMetadata,
		controller,
		setController,
		handleTextareaResize,
		clearMessages,
		resetMetadata,
		abortQuery,
		deleteThread,
		arcade,
		setArcade,
		streamingRate,
		filesMap,
		setFilesMap,
		submissionFiles,
		setSubmissionFiles,
		todos,
		setTodos,
		viewMode,
		setViewMode,
		ttft,
		submitStartTime,
		addFile,
		updateFileContent,
		removeFile,
		renameFile,
		getFilesForSubmission,
		runError,
		setRunError,
		streamStatus,
	};
}
