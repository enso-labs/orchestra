import { useChatContext } from '@/context/ChatContext';
import debug from 'debug';
import { useState, useEffect } from 'react';
import { 
  Wrench, Compass, Brain, Feather, Cloud, Database, 
  Search, BookOpen, Globe, Infinity, Leaf
} from "lucide-react";
import apiClient from '@/lib/utils/apiClient';
import { INIT_TOOL_STATE, useToolReducer } from '@/reducers/toolReducer';

debug.enable('hooks:*');

const TOOL_ICONS: Record<string, any> = {
  default: Wrench,
  search: Search,
  search_engine: Search,
  knowledge: BookOpen,
  web: Globe,
  database: Database,
  filestore: Feather,
  assistant: Brain,
  weather: Cloud,
  navigation: Compass,
  meditation: Infinity,
  nature: Leaf,
};

export default function useToolHook() {
	const { 
		payload, 
		setPayload, 
		availableTools,
		setCurrentToolCall,
		setIsToolCallInProgress,
	} = useChatContext();
  const {state, actions} = useToolReducer();
  const {
    testingTool,
    testFormValues,
    isAddingMCP,
    mcpCode,
    toolFilter,
  } = state;
  const {
    setTestFormValues,
    setTestingTool,
    setIsAddingMCP,
    setMcpCode,
    setMcpError,
    setHasSavedMCP,
    setHasSavedA2A,
  } = actions;
  const [isAssistantOpen,] = useState(INIT_TOOL_STATE.isAssistantOpen);

	const clearTools = () => {
    setPayload((prev: { tools: any[]; }) => ({
      ...prev,
      tools: []
    }));
  };

	const toggleTool = (toolId: string) => {
    setPayload((prev: { tools: any[]; }) => {
      const currentTools = prev.tools || [];
      const isSelected = currentTools.includes(toolId);
      
      return {
        ...prev,
        tools: isSelected 
          ? currentTools.filter(id => id !== toolId)
          : [...currentTools, toolId]
      };
    });
  };

	const testTool = (tool: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggling the tool selection
    
    // Initialize form values with defaults
    const initialValues: Record<string, any> = {};
    if (tool.args) {
      Object.entries(tool.args).forEach(([key, value]: [string, any]) => {
        // If the arg has a default value, use it
        if (value && value.default !== undefined) {
          initialValues[key] = value.default;
        } else {
          // Otherwise initialize with appropriate empty value based on type
          const type = value?.type || 'string';
          initialValues[key] = type === 'integer' || type === 'number' ? 0 : 
                               type === 'boolean' ? false : 
                               type === 'array' ? [] : '';
        }
      });
    }
    
    setTestFormValues(initialValues);
    setTestingTool(tool);
  };

	const handleInputChange = (key: string, value: any) => {
    setTestFormValues((prev: Record<string, any>) => ({
      ...prev,
      [key]: value
    }));
  };

  const cancelTesting = () => {
    setTestingTool(null);
  };

  const startAddingMCP = () => {
    setIsAddingMCP(true);
  };

  const cancelAddingMCP = () => {
    setIsAddingMCP(false);
    setMcpError('');
    
    // Reset the editor to the current payload MCP if one exists
    if (payload.mcp) {
      setMcpCode(JSON.stringify(payload.mcp, null, 2));
    } else {
      setMcpCode(INIT_TOOL_STATE.mcpCode);
    }
  };

  const saveMCPConfig = () => {
    try {
      // Validate JSON
      const parsedConfig = JSON.parse(mcpCode);
      
      // Update payload
      setPayload((prev: { mcp: any; }) => ({
        ...prev,
        mcp: parsedConfig
      }));
      
      // Update state to show config is saved
      setHasSavedMCP(true);
      
      // Clear any previous errors
      setMcpError('');
      
    } catch (e) {
      setMcpError('Invalid JSON format. Please check your configuration.');
    }
  };
  
  const removeMCPConfig = () => {
    // Remove from payload
    setPayload((prev: { mcp: any; }) => {
      const { mcp, ...rest } = prev;
      return rest;
    });
    
    // Update state
    setHasSavedMCP(false);
    
    // Reset to default
    setMcpCode(INIT_TOOL_STATE.mcpCode);
    
    // If removing while in edit mode, we'll keep it open
    if (!isAddingMCP) {
      setIsAddingMCP(false);
    }
  };

  // Filter tools based on search input
  const filteredTools = availableTools.filter((tool: any) => 
    tool.id.toLowerCase().includes(toolFilter.toLowerCase()) || 
    (tool.description && tool.description.toLowerCase().includes(toolFilter.toLowerCase()))
  );

  // Group tools by category
  const toolsByCategory = filteredTools.reduce((acc: Record<string, any[]>, tool: any) => {
    const category = tool.tags && tool.tags.length > 0 ? tool.tags[0] : 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(tool);
    return acc;
  }, {});

	const handleTestFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!testingTool) return;
    
    // Create a tool call message for the Action Log
    const toolCallData = {
      id: `test-${Date.now()}`,
      role: 'tool',
      name: testingTool.id,
      content: JSON.stringify(testFormValues, null, 2),
      status: 'running',
      type: 'tool_call',
      timestamp: new Date().toISOString()
    };

    // Update the UI to show that a tool call is in progress
    setCurrentToolCall(toolCallData);
    setIsToolCallInProgress(true);
    
    // Close the form
    setTestingTool(null);
    
    try {
      // Call the API with the tool ID and form values
      const response = await apiClient.post(`/tools/${testingTool.id}/invoke`, {
        args: testFormValues
      });
      
      // Update the tool call with the result
      const updatedToolCall = {
        ...toolCallData,
        status: 'success',
        output: typeof response.data.output === 'object' 
          ? JSON.stringify(response.data.output, null, 2) 
          : response.data.output
      };
      
      // Send the updated tool call to the context
      setCurrentToolCall(updatedToolCall);
      
    } catch (error: any) {
      // Update the tool call with the error
      const updatedToolCall = {
        ...toolCallData,
        status: 'error',
        output: error.response?.data?.error || 'An error occurred',
        error: error.response?.data?.error,
        traceback: error.response?.data?.traceback
      };
      
      // Send the updated tool call to the context
      setCurrentToolCall(updatedToolCall);
    }
  };

	const useLoadMCPFromPayloadEffect = () => {
		useEffect(() => {
			if (payload.mcp) {
				setMcpCode(JSON.stringify(payload.mcp, null, 2));
				setHasSavedMCP(true);
			}
			return () => {
				setMcpCode(INIT_TOOL_STATE.mcpCode);
				setHasSavedMCP(false);
			}
			
		}, [payload.mcp]);
	}

  const startAddingA2A = () => {
    setHasSavedA2A(true);
  };

	return {
    ...state,
    ...actions,
		isAssistantOpen,
		// actions
		clearTools,
		testTool,
		handleInputChange,
		cancelTesting,
		startAddingMCP,
		cancelAddingMCP,
		saveMCPConfig,
		removeMCPConfig,
		toggleTool,
		handleTestFormSubmit,
    startAddingA2A,
		// computed
		filteredTools,
		toolsByCategory,
		// effects
		useLoadMCPFromPayloadEffect,
		TOOL_ICONS,
	}
}