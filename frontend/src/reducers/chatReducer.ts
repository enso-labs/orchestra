import { useReducer, useRef } from 'react';
import { ThreadPayload } from '../entities';
import { Model } from '@/services/modelService';

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
}

type ChatAction = {
    type: string;
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
    availableTools: []
}

// Reducer
export const chatReducer = (state: ChatState, action: ChatAction) => {
    switch (action.type) {
        case 'SET_RESPONSE':
            return { ...state, response: action.payload };
        case 'SET_MESSAGES':
            return { ...state, messages: action.payload };
        case 'UPDATE_PAYLOAD':
            return { ...state, payload: { ...state.payload, ...action.payload } };
        case 'SET_HISTORY':
            return { ...state, history: action.payload };
        case 'SET_MODELS':
            return { ...state, models: action.payload };
        case 'SET_SETTINGS':
            return { ...state, settings: action.payload };
        case 'SET_PRESET':
            return { ...state, preset: action.payload };
        case 'SET_TOOL_CALL_MESSAGE':
            return { ...state, toolCallMessage: action.payload };
        case 'SET_IS_TOOL_CALL_IN_PROGRESS':
            return { ...state, isToolCallInProgress: action.payload };
        case 'SET_CURRENT_TOOL_CALL':
            return { ...state, currentToolCall: action.payload };
        case 'SET_SELECTED_TOOL_MESSAGE':
            return { ...state, selectedToolMessage: action.payload };
        case 'SET_TOOL_CALL':
            return { ...state, toolCall: action.payload };
        case 'SET_AVAILABLE_TOOLS':
            return { ...state, availableTools: action.payload };
        case 'RESET_STATE':
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
            dispatch({ type: 'SET_RESPONSE', payload: response }),
            
        setMessages: (messages: any[]) =>
            dispatch({ type: 'SET_MESSAGES', payload: messages }),
            
        updatePayload: (payload: Partial<ThreadPayload>) =>
            dispatch({ type: 'UPDATE_PAYLOAD', payload }),
            
        setHistory: (history: any) =>
            dispatch({ type: 'SET_HISTORY', payload: history }),
            
        setModels: (models: Model[]) =>
            dispatch({ type: 'SET_MODELS', payload: models }),
            
        setSettings: (settings: any[]) =>
            dispatch({ type: 'SET_SETTINGS', payload: settings }),
            
        setPreset: (preset: any) =>
            dispatch({ type: 'SET_PRESET', payload: preset }),
            
        setToolCallMessage: (message: any) =>
            dispatch({ type: 'SET_TOOL_CALL_MESSAGE', payload: message }),
            
        setIsToolCallInProgress: (inProgress: boolean) =>
            dispatch({ type: 'SET_IS_TOOL_CALL_IN_PROGRESS', payload: inProgress }),
            
        setCurrentToolCall: (toolCall: any) =>
            dispatch({ type: 'SET_CURRENT_TOOL_CALL', payload: toolCall }),
            
        setSelectedToolMessage: (message: any) =>
            dispatch({ type: 'SET_SELECTED_TOOL_MESSAGE', payload: message }),
            
        setToolCall: (toolCall: { input: string }) =>
            dispatch({ type: 'SET_TOOL_CALL', payload: toolCall }),
            
        setAvailableTools: (tools: any[]) =>
            dispatch({ type: 'SET_AVAILABLE_TOOLS', payload: tools }),
            
        resetState: () =>
            dispatch({ type: 'RESET_STATE' })
    };

    return {
        state,
        actions,
        responseRef,
        toolCallRef
    };
} 