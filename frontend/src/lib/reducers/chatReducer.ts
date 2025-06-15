import { useReducer, useRef } from 'react';
import { ThreadPayload } from '../entities';
import { Model } from '@/lib/services/modelService';
import { SSE } from 'sse.js';

// Action Types Enum
export enum ChatActionType {
    SET_RESPONSE = 'SET_RESPONSE',
    SET_MESSAGES = 'SET_MESSAGES',
    SET_PAYLOAD = 'SET_PAYLOAD',
    SET_HISTORY = 'SET_HISTORY',
    SET_MODELS = 'SET_MODELS',
    SET_SETTINGS = 'SET_SETTINGS',
    SET_PRESET = 'SET_PRESET',
    SET_TOOL_CALL_MESSAGE = 'SET_TOOL_CALL_MESSAGE',
    SET_IS_TOOL_CALL_IN_PROGRESS = 'SET_IS_TOOL_CALL_IN_PROGRESS',
    SET_CURRENT_TOOL_CALL = 'SET_CURRENT_TOOL_CALL',
    SET_SELECTED_TOOL_MESSAGE = 'SET_SELECTED_TOOL_MESSAGE',
    SET_TOOL_CALL = 'SET_TOOL_CALL',
    SET_AVAILABLE_TOOLS = 'SET_AVAILABLE_TOOLS',
    RESET_STATE = 'RESET_STATE'
}

// Types
type ChatState = {
    response: any | null;
    messages: any[];
    settings: any[];
    preset: any | null;
    toolCallMessage: any | null;
    payload: ThreadPayload;
    history: {
        threads: any[];
        page: number;
        per_page: number;
        total: number;
        next_page: string;
    };
    models: Model[];
    isToolCallInProgress: boolean;
    currentToolCall: any | null;
    selectedToolMessage: any | null;
    toolCall: {
        input: string;
    };
    availableTools: any[];
    controller: AbortController | null;
    conn: SSE | null;
}

type ChatAction = {
    type: ChatActionType;
    payload?: any;
}

// Initial State
export const INIT_CHAT_STATE: ChatState = {
    response: null,
    messages: [],
    settings: [],
    preset: null,
    toolCallMessage: null,
    payload: {
        threadId: '',
        images: [],
        query: '',
        system: 'You are a helpful assistant.',
        tools: [],
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
    selectedToolMessage: null,
    toolCall: {
        input: ""
    },
    availableTools: [],
    controller: null,
    conn: null,
}

// Reducer
export const chatReducer = (state: ChatState, action: ChatAction) => {
    switch (action.type) {
        case ChatActionType.SET_RESPONSE:
            return { ...state, response: action.payload };
        case ChatActionType.SET_MESSAGES:
            return { ...state, messages: action.payload };
        case ChatActionType.SET_PAYLOAD:
            return { ...state, payload: { ...state.payload, ...action.payload } };
        case ChatActionType.SET_HISTORY:
            return { ...state, history: action.payload };
        case ChatActionType.SET_MODELS:
            return { ...state, models: action.payload };
        case ChatActionType.SET_SETTINGS:
            return { ...state, settings: action.payload };
        case ChatActionType.SET_PRESET:
            return { ...state, preset: action.payload };
        case ChatActionType.SET_TOOL_CALL_MESSAGE:
            return { ...state, toolCallMessage: action.payload };
        case ChatActionType.SET_IS_TOOL_CALL_IN_PROGRESS:
            return { ...state, isToolCallInProgress: action.payload };
        case ChatActionType.SET_CURRENT_TOOL_CALL:
            return { ...state, currentToolCall: action.payload };
        case ChatActionType.SET_SELECTED_TOOL_MESSAGE:
            return { ...state, selectedToolMessage: action.payload };
        case ChatActionType.SET_TOOL_CALL:
            return { ...state, toolCall: action.payload };
        case ChatActionType.SET_AVAILABLE_TOOLS:
            return { ...state, availableTools: action.payload };
        case ChatActionType.RESET_STATE:
            return INIT_CHAT_STATE;
        default:
            return state;
    }
};

// Hook
export function useChatReducer() {
    const [state, dispatch] = useReducer(chatReducer, INIT_CHAT_STATE);
    const responseRef = useRef("");
    const toolCallRef = useRef("");

    const actions = {
        setResponse: (response: any) => 
            dispatch({ type: ChatActionType.SET_RESPONSE, payload: response }),
            
        setMessages: (messages: any[]) =>
            dispatch({ type: ChatActionType.SET_MESSAGES, payload: messages }),
            
        setPayload: (payload: Partial<ThreadPayload>) =>
            dispatch({ type: ChatActionType.SET_PAYLOAD, payload }),
            
        setHistory: (history: any) =>
            dispatch({ type: ChatActionType.SET_HISTORY, payload: history }),
            
        setModels: (models: Model[]) =>
            dispatch({ type: ChatActionType.SET_MODELS, payload: models }),
            
        setSettings: (settings: any[]) =>
            dispatch({ type: ChatActionType.SET_SETTINGS, payload: settings }),
            
        setPreset: (preset: any) =>
            dispatch({ type: ChatActionType.SET_PRESET, payload: preset }),
            
        setToolCallMessage: (message: any) =>
            dispatch({ type: ChatActionType.SET_TOOL_CALL_MESSAGE, payload: message }),
            
        setIsToolCallInProgress: (inProgress: boolean) =>
            dispatch({ type: ChatActionType.SET_IS_TOOL_CALL_IN_PROGRESS, payload: inProgress }),
            
        setCurrentToolCall: (toolCall: any) =>
            dispatch({ type: ChatActionType.SET_CURRENT_TOOL_CALL, payload: toolCall }),
            
        setSelectedToolMessage: (message: any) =>
            dispatch({ type: ChatActionType.SET_SELECTED_TOOL_MESSAGE, payload: message }),
            
        setToolCall: (toolCall: { input: string }) =>
            dispatch({ type: ChatActionType.SET_TOOL_CALL, payload: toolCall }),
            
        setAvailableTools: (tools: any[]) =>
            dispatch({ type: ChatActionType.SET_AVAILABLE_TOOLS, payload: tools }),
            
        resetState: () =>
            dispatch({ type: ChatActionType.RESET_STATE })
    };

    return {
        state,
        actions,
        responseRef,
        toolCallRef
    };
} 