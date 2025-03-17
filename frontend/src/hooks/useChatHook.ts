import debug from 'debug';
import { SSE } from "sse.js";
import { useEffect, useRef, useState } from "react";
import { ThreadPayload } from '../entities';
import { TOKEN_NAME, VITE_API_URL } from '../config';
import apiClient from '@/lib/utils/apiClient';
import { listModels, Model } from '@/services/modelService';
import { listTools } from '../services/toolService';

const KEY_NAME = 'mcp-config';

debug.enable('hooks:*');
const logger = debug('hooks:useChatHook');

const initChatState = {
    response: null,
    responseRef: "",
    messages: [],
    settings: [],
    preset: null,
    toolCallMessage: null,
    payload: {
        threadId: '',
        images: [] as string[],
        query: '',
        system: 'You are a helpful assistant.',
        tools: [] as any[],
        visualize: false,
        model: '',
        mcp: null
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
}

export default function useChatHook() {
    const token = localStorage.getItem(TOKEN_NAME);
    const responseRef = useRef(initChatState.responseRef);
    const [response, setResponse] = useState<any>(initChatState.response);  
    const [messages, setMessages] = useState<any[]>(initChatState.messages);
    const [payload, setPayload] = useState(initChatState.payload);
    const [history, setHistory] = useState<any>(initChatState.history);
    const [settings, setSettings] = useState<any>(initChatState.settings);
    const [models, setModels] = useState<Model[]>(initChatState.models);
    const [availableTools, setAvailableTools] = useState([]);
    const [toolCallMessage, setToolCallMessage] = useState<any>(initChatState.toolCallMessage);
    const [isToolCallInProgress, setIsToolCallInProgress] = useState(false);
    const [currentToolCall, setCurrentToolCall] = useState<any>(null);
    const [preset, setPreset] = useState<any>(initChatState.preset);

    const currentModel = models.find((model: Model) => model.id === payload.model);
    const enabledTools = availableTools
        .filter((tool: any) => payload.tools.includes(tool.id));


    const constructSystemPrompt = (systemPrompt: string) => {
        return `${systemPrompt}
---
Current Date and Time: ${new Date().toLocaleString()}
Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
Language: ${navigator.language}
`;
    }
    
    const handleQuery = (agentId: string = '') => {
        queryThread(payload, agentId);
    }

    const queryThread = (payload: ThreadPayload, agentId: string = '') => {
        logger("Querying thread:", payload);
        const updatedMessages = [...messages, { role: 'user', content: payload.query }];
        setMessages(updatedMessages);
        setResponse("");
        responseRef.current = "";
        const responseData = agentId ? {
            query: payload.query,
        } : {
            ...payload,
            system: constructSystemPrompt(payload.system)
        }
        const url = agentId ? `/agents/${agentId}/threads` : '/threads';
        const source = new SSE(`${VITE_API_URL}${url}${payload.threadId ? `/${payload.threadId}` : ''}`,
            {
                headers: {
                    'Content-Type': 'application/json', 
                    'Accept': 'text/event-stream',
                    'Authorization': `Bearer ${token}`
                },
                payload: JSON.stringify(responseData),
                method: 'POST'
            }
        );

        source.addEventListener("error", (e: any) => {
            logger("Error received from server:", e);
            const errData = JSON.parse(e?.data);
            alert(errData?.detail);
            source.close();
            throw new Error(errData?.detail);
        });

        source.addEventListener("open", () => {
            const messagesWithAssistant = [...updatedMessages, { role: "assistant", content: "" }];
            setMessages(messagesWithAssistant);
        });

        source.addEventListener("message", (e: any) => {
            const data = JSON.parse(e.data);
            const message = data.content;
            logger("Message received:", message);

            if (data.event === 'ai_chunk') {
                responseRef.current += message;
                const finalMessages = [...messages, 
                    { role: 'user', content: payload.query },
                    { role: "assistant", content: responseRef.current }
                ];
                setMessages(finalMessages);
            } else if (data.event === 'tool_call') {
                const toolCallData = {
                    content: message.content || message,
                    type: 'tool',
                    name: message.name,
                    status: 'pending',
                    tool_call_id: message.id,
                    id: crypto.randomUUID()
                };
                
                setCurrentToolCall(toolCallData);
                setIsToolCallInProgress(true);
                
                const updatedMessages = [...messages, toolCallData];
                setMessages(updatedMessages);
            } else if (data.event === 'tool_chunk') {
                const toolChunkData = {
                    content: message.content || message,
                    type: 'tool',
                    name: message.name,
                    status: 'success',
                    tool_call_id: message.id,
                    isOutput: true
                };
                
                setCurrentToolCall((prev: any) => ({
                    ...prev,
                    output: toolChunkData.content,
                    status: 'success'
                }));
                
                const updatedMessages = [...messages, toolChunkData];
                setMessages(updatedMessages);
            } else if (data.event === 'end') {
                if (toolCallMessage) {
                    const updatedMessages = [...messages, toolCallMessage];
                    setMessages(updatedMessages);
                    setToolCallMessage(null);
                }
                getHistory(1, history.per_page, agentId);
                source.close();
                logger("Thread ended");
                return;
            }

            setPayload((prev) => ({ ...prev, query: '', threadId: data.thread_id, images: [], mcp: prev.mcp }));
        });
        source.stream();
        return true;
    };

    const getHistory = async (page: number = 1, perPage: number = 20, agentId: string = '') => {
        try {
            const url = agentId ? `/agents/${agentId}/threads` : '/threads';
            const params = { page, perPage };
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

    // Add this function after fetchTools
    const fetchSettings = async () => {
        try {
            const response = await apiClient.get('/settings');
            setSettings(response.data.settings || []);
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        }
    };

    const fetchModels = async (setSearchParams: (params: any) => void, currentModel: string) => {
        try {
            const response = await listModels();
            setModels(response.models);
            
            // Set default model if none selected
            if (!currentModel && response.models.length > 0) {
                setSearchParams({ model: response.models.find((model: Model) => model.id === "openai-gpt-4o-mini")?.id });
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

    // Add this effect hook after useToolsEffect
    const useSettingsEffect = () => {
        useEffect(() => {
            fetchSettings();
        }, []);

        return () => {
            // Cleanup logic if needed
        };
    };

    const useMCPEffect = () => {
        useEffect(() => {
            // When payload.mcp changes, update localStorage
            if (payload.mcp) {
                localStorage.setItem(KEY_NAME, JSON.stringify(payload.mcp));
            } else {
                localStorage.removeItem(KEY_NAME);
            }
        }, [payload.mcp]);
    };

    const useFetchModelsEffect = (setSearchParams: (params: any) => void, currentModel: string) => {
        useEffect(() => {
            fetchModels(setSearchParams, currentModel);

            return () => {
                // Cleanup logic if needed
            };
        }, []);
    };

    const useSelectModelEffect = (currentModel: string) => {
        useEffect(() => {
            if (currentModel) {
                setPayload({ ...payload, model: currentModel });
            }
        }, [currentModel, setPayload]);

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
        settings,
        setSettings,
        useSettingsEffect,
        fetchSettings,
        preset,
        setPreset,
        currentModel,
        enabledTools,
        useMCPEffect
    };
}
