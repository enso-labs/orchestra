import { useReducer } from 'react';

// Types
type ToolState = {
	toolFilter: string;
	expanded: Record<string, boolean>;
	groupByCategory: boolean;
	testingTool: any | null;
	testFormValues: Record<string, any>;
	isAddingMCP: boolean;
	mcpCode: string;
	mcpError: string;
	hasSavedMCP: boolean;
	isAssistantOpen: boolean;
	selectedToolMessage: any | null;
}

type ToolAction = {
	type: string;
	payload?: any;
}

// Constants
const defaultMCP = {
	"enso_mcp": {
		"transport": "sse",
		"url": "https://mcp.enso.sh/sse"
	}
}

export const INIT_TOOL_STATE: ToolState = {
	toolFilter: "",
	expanded: {},
	groupByCategory: true,
	testingTool: null,
	testFormValues: {},
	isAddingMCP: false,
	mcpCode: JSON.stringify(defaultMCP, null, 2),
	mcpError: '',
	hasSavedMCP: false,
	isAssistantOpen: false,
	selectedToolMessage: null,
}

// Reducer
export const toolReducer = (state: ToolState, action: ToolAction) => {
	switch (action.type) {
		case 'SET_IS_ASSISTANT_OPEN':
			return { ...state, isAssistantOpen: action.payload };
		case 'SET_SELECTED_TOOL_MESSAGE':
			return { ...state, selectedToolMessage: action.payload };
		case 'SET_TOOL_FILTER':
			return { ...state, toolFilter: action.payload };
		case 'SET_EXPANDED':
			return { ...state, expanded: action.payload };
		case 'SET_GROUP_BY_CATEGORY':
			return { ...state, groupByCategory: action.payload };
		case 'SET_TESTING_TOOL':
			return { ...state, testingTool: action.payload };
		case 'SET_TEST_FORM_VALUES':
			return { ...state, testFormValues: action.payload };
		case 'SET_IS_ADDING_MCP':
			return { ...state, isAddingMCP: action.payload };
		case 'SET_MCP_CODE':
			return { ...state, mcpCode: action.payload };
		case 'SET_MCP_ERROR':
			return { ...state, mcpError: action.payload };
		case 'SET_HAS_SAVED_MCP':
			return { ...state, hasSavedMCP: action.payload };
		case 'RESET_STATE':
			return INIT_TOOL_STATE;
		default:
			return state;
	}
};

// Hook
export function useToolReducer() {
	const [state, dispatch] = useReducer(toolReducer, INIT_TOOL_STATE);

	const actions = {
		
		setToolFilter: (filter: string) => 
			dispatch({ type: 'SET_TOOL_FILTER', payload: filter }),
		
		setExpanded: (expanded: Record<string, boolean>) => 
			dispatch({ type: 'SET_EXPANDED', payload: expanded }),
		
		setGroupByCategory: (value: boolean) => 
			dispatch({ type: 'SET_GROUP_BY_CATEGORY', payload: value }),
		
		setTestingTool: (tool: any) => 
			dispatch({ type: 'SET_TESTING_TOOL', payload: tool }),
		
		setTestFormValues: (values: Record<string, any>) => 
			dispatch({ type: 'SET_TEST_FORM_VALUES', payload: values }),
		
		setIsAddingMCP: (value: boolean) => 
			dispatch({ type: 'SET_IS_ADDING_MCP', payload: value }),
		
		setMcpCode: (code: string) => 
			dispatch({ type: 'SET_MCP_CODE', payload: code }),
		
		setMcpError: (error: string) => 
			dispatch({ type: 'SET_MCP_ERROR', payload: error }),
		
		setHasSavedMCP: (value: boolean) => 
			dispatch({ type: 'SET_HAS_SAVED_MCP', payload: value }),
		
		setIsAssistantOpen: (value: boolean) => 
			dispatch({ type: 'SET_IS_ASSISTANT_OPEN', payload: value }),
		
		setSelectedToolMessage: (message: any) => 
			dispatch({ type: 'SET_SELECTED_TOOL_MESSAGE', payload: message }),
		
		resetState: () => 
			dispatch({ type: 'RESET_STATE' })
	};

	return {
		state,
		actions
	};
}