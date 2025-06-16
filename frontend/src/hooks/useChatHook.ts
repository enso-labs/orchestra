import debug from 'debug';
import { useEffect, useRef, useState } from "react";
import { ThreadPayload } from '../lib/entities';
import apiClient from '@/lib/utils/apiClient';
import { listModels, Model } from '@/lib/services/modelService';
import { listTools } from '@/lib/services/toolService';
import { useChatReducer } from '@/lib/reducers/chatReducer';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/config/instruction';
import { DEFAULT_CHAT_MODEL, isValidModelName } from '@/lib/config/llm';
import { getAuthToken } from '@/lib/utils/auth';
import { streamThread } from '@/lib/services/threadService';
import { useAppContext } from '@/context/AppContext';

const KEY_NAME = 'config:mcp';

debug.enable('hooks:*');
const logger = debug('hooks:useChatHook');

const initChatState = {
    response: null,
    responseRef: "",
    toolCallRef: "",
    messagesEndRef: null,
    messages: [],
    settings: [],
    preset: null,
    toolCallMessage: null,
    payload: {
        agent: null,
        threadId: '',
        images: [] as string[],
        query: '',
        system: DEFAULT_SYSTEM_PROMPT,
        tools: [] as any[],
        visualize: false,
        model: '',
        memory: true,
        mcp: null,
        a2a: null,
        collection: null,
        arcade: {
            tools: [] as string[],
            toolkit: [] as string[],
        }
    },
    history: {
        threads: [],
        page: 1,
        per_page: 20,
        total: 0,
        next_page: '',
    },
    models: [],
    isToolCallInProgress: false,
    currentToolCall: null,
    selectedToolMessage: null,
}

export default function useChatHook() {
    const {state, actions} = useChatReducer();
    const {
        response,
        models,
        availableTools,
        toolCallMessage,
        isToolCallInProgress,
        currentToolCall,
        selectedToolMessage,
        messages,
        history,
        preset,
        toolCall,
    } = state;
    const {
        setResponse,
        setModels,
        setAvailableTools,
        setToolCallMessage,
        setIsToolCallInProgress,
        setCurrentToolCall,
        setSelectedToolMessage,
        setHistory,
        setPreset,
        setToolCall,
        setMessages,
    } = actions;
    const { setLoading, setLoadingMessage } = useAppContext();
    const token = getAuthToken();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const responseRef = useRef(initChatState.responseRef);
    const toolCallRef = useRef(initChatState.toolCallRef);
    const [payload, setPayload] = useState(initChatState.payload);

    const currentModel = models.find((model: Model) => model.id === payload.model);
    const enabledTools = availableTools
        .filter((tool: any) => payload.tools.includes(tool.id))

    const [controller, setController] = useState<AbortController | null>(null);
    
    const handleQuery = (agentId: string = '') => {
        const { controller } = queryThread(payload, agentId, messages);
        setController(controller);
    }

    const abortQuery = () => {
        if (controller) {
            controller.abort();
            setController(null);
        }
    }

    const handleTextareaResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const textarea = e.target
		textarea.style.height = "auto"
		textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
		setPayload({ ...payload, query: e.target.value })
	}

    const handleToolCallChunk = (chunk: string) => {
        toolCallRef.current += chunk;
        setToolCall({
            input: toolCallRef.current,
        });
    }

    const queryThread = (
		payload: ThreadPayload, 
		agentId: string = '', 
		previousMessages: any[] = [],
		abortController?: AbortController
	) => {
		logger("Querying thread:", payload);
		setLoading(true);
		setLoadingMessage('Querying...');
		let messagesWithAssistant = [...previousMessages, { role: 'user', content: payload.query }];
		setMessages(messagesWithAssistant);
		setResponse("");
		responseRef.current = "";
		
		// Create a new AbortController if one wasn't provided
		const controller = abortController || new AbortController();
		const source = streamThread(payload, agentId);
		
		// Error handling
		source.addEventListener("error", (e: any) => {
			logger("Error received from server:", e);
			const errData = JSON.parse(e?.data);
			alert(errData?.detail);
			source.close();
		});

		// Open handling
		source.addEventListener("open", () => {
			logger("Connection opened");
		});

		// Message handling
		source.addEventListener("message", (e: any) => {
			logger("Message received:", e);
			const data = JSON.parse(e.data);
			const lastMessage = messagesWithAssistant[messagesWithAssistant.length - 1];

			if (data.msg.type === 'AIMessageChunk' && data.msg.tool_call_chunks.length > 0) {
				logger("Tool call received:", data.msg);
				const toolCallChunk = data.msg.tool_call_chunks[data.msg.tool_call_chunks.length - 1].args;
				handleToolCallChunk(toolCallChunk);
                setLoadingMessage('Constructing tool input...');
				if (lastMessage.role !== 'tool') {
					messagesWithAssistant = [...messagesWithAssistant, { role: "tool", args: toolCallRef.current }];
				}
			} else if (data.msg.type === 'tool') {
				logger("Tool chunk received:", data.msg);
				// Instead of modifying the last tool message, add a new one
				messagesWithAssistant = [...messagesWithAssistant, { 
					role: "tool", 
					args: toolCallRef.current, 
					...data.msg 
				}];
                if (toolCallRef.current.length > 0) {
                    setLoadingMessage('Fetching tool response...');
                    setLoading(false);
                }
				setMessages(messagesWithAssistant);
			} else if (data.msg.type === 'stop' || data.msg.response_metadata?.finish_reason === 'stop') {
				source.close();
				logger("Thread ended");
				if (getAuthToken()) getHistory(1, history.per_page, agentId);
				setController(null);
				return;
			} else {
				responseRef.current += typeof data.msg.content === 'string' 
					? data.msg.content 
					: (data.msg.content[0]?.text || '');
				if (responseRef.current.length > 0) setLoading(false);
				setMessages([...messagesWithAssistant, { role: "assistant", content: responseRef.current }]);
			}
			setPayload((prev: any) => ({ ...prev, query: '', threadId: data.metadata.thread_id, images: [], mcp: prev.mcp }));
		});

		// Close handling
		source.addEventListener("close", () => {
			logger("Connection closed");
            setController(null);
            setLoading(false);
		});

		// Retry handling
		source.addEventListener("retry", () => {
			logger("Connection retrying");
		});

		// Reconnect handling
		source.addEventListener("reconnect", () => {
			logger("Connection reconnected");
		});

		// Reconnect attempt handling
		source.addEventListener("reconnectAttempt", () => {
			logger("Connection reconnect attempt");
		});

		// Stream handling
		source.stream();
		responseRef.current = "";
		toolCallRef.current = "";
		
		// Setup abort capability
		controller.signal.addEventListener('abort', () => {
			logger("Aborting stream connection");
			source.close();
			setLoading(false);
		});
		
		// Return the controller so the caller can abort if needed
		return {
            controller,
            source,
        };
	}

    const getHistory = async (page: number = 1, perPage: number = 20, agentId: string = '') => {
        try {
            const url = agentId ? `/agents/${agentId}/threads` : '/threads';
            const params = { page, per_page: perPage };
            const res = await apiClient.get(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json', 
                    'Authorization': `Bearer ${token}`
                },
                method: 'GET',
                params
            }); 
            setHistory(res.data);
        } catch (error: any) {
            logger('Error listing threads:', error);
            throw new Error(error.response?.data?.detail || 'Failed to list threads');
        }
    }

    const fetchModels = async (setSearchParams: (params: any) => void, currentModel: string = DEFAULT_CHAT_MODEL) => {
        try {
            const response = await listModels();
            setModels(response.models);
            
            // Set default model if none selected
            if (!currentModel && response.models.length > 0) {
                setSearchParams({ model: response.models.find((model: Model) => model.id === DEFAULT_CHAT_MODEL)?.id });
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
        }
    };

    const handleNewChat = () => {
        setMessages([]);
        setPayload((prev: any) => ({ ...prev, threadId: '', query: '' }));
    };

    const useGetHistoryEffect = (agentId: string = '') => {
        useEffect(() => {
            getHistory(history.page, history.per_page, agentId);

            return () => {
                // Cleanup logic if needed
            };
        }, []);
    };


    const useMCPEffect = () => {
        useEffect(() => {
            // Check if mcp payload is not set and set it from localStorage if it exists
            if (!payload.mcp) {
                const storedMCP = localStorage.getItem(KEY_NAME);
                if (storedMCP) {
                    setPayload((prev: any) => ({ ...prev, mcp: JSON.parse(storedMCP) }));
                }
            } 
            // When payload.mcp changes, update localStorage
            else {
                localStorage.setItem(KEY_NAME, JSON.stringify(payload.mcp));
            }
        }, [payload.mcp]);
    };

    const useA2AEffect = () => {
        useEffect(() => {
            // When payload.mcp changes, update localStorage
            if (payload.a2a) {
                localStorage.setItem("config:a2a", JSON.stringify(payload.a2a));
            } else {
                localStorage.removeItem("config:a2a");
            }
        }, [payload.a2a]);
    };

    const useFetchModelsEffect = (setSearchParams: (params: any) => void, currentModel: string = DEFAULT_CHAT_MODEL) => {
        useEffect(() => {
            fetchModels(setSearchParams, currentModel);

            return () => {
                // Cleanup logic if needed
            };
        }, []);
    };

    const useSelectModelEffect = (currentModel: string = DEFAULT_CHAT_MODEL) => {
        useEffect(() => {
            if (!isValidModelName(currentModel)) {
                setPayload({ ...payload, model: DEFAULT_CHAT_MODEL });
            } else {
                setPayload({ ...payload, model: currentModel });
            }
        }, [currentModel]);

        return () => {
            // Cleanup logic if needed
        };
    };

    const fetchTools = async () => {
        try {
            const response = await listTools();
            setAvailableTools(response.tools);
        } catch (error) {
            console.error('Failed to fetch tools:', error);
        }
    };

    const useToolsEffect = () => {
        useEffect(() => {
            fetchTools();
        }, []);
    };

    const deleteThread = async (threadId: string) => {
        try {
            await apiClient.delete(`/threads/${threadId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            // Refresh the thread list after deletion
            getHistory(history.page, history.per_page);
            handleNewChat();
        } catch (error: any) {
            console.error('Error deleting thread:', error);
            throw new Error(error.response?.data?.detail || 'Failed to delete thread');
        }
    };

    return {
        ...initChatState,
        messagesEndRef,
        messages,
        setMessages,
        responseRef,
        response,
        setResponse,
        handleQuery,
        payload,
        setPayload,
        toolCallMessage,
        setToolCallMessage,
        getHistory,
        history,
        setHistory,
        useGetHistoryEffect,
        useFetchModelsEffect,
        models,
        setModels,
        useSelectModelEffect,
        handleNewChat,
        availableTools,
        setAvailableTools,
        useToolsEffect,
        deleteThread,
        isToolCallInProgress,
        setIsToolCallInProgress,
        currentToolCall,
        setCurrentToolCall,
        preset,
        setPreset,
        currentModel,
        enabledTools,
        useMCPEffect,
        selectedToolMessage,
        setSelectedToolMessage,
        toolCall,
        setToolCall,
        useA2AEffect,
        abortQuery,
        controller,
        setController,
        handleTextareaResize,
    };
}
