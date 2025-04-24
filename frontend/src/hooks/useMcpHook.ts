import debug from 'debug';
import apiClient from '@/lib/utils/apiClient';
import { useCallback, useEffect, useState } from 'react';
import { useChatContext } from '@/context/ChatContext';
import { listPublicServers } from '@/services/serverService';

debug.enable('hooks:*');
// const logger = debug('hooks:useMcpHook');

// const defaultMCP = {
//   "enso_basic": {
//     "transport": "sse",
//     "url": "https://mcp.enso.sh/sse"
//   }
// }
const defaultMCP = {}
const INIT_MCP_STATE = {
	mcpInfo: null,
	mcpCode: JSON.stringify(defaultMCP, null, 2),
	mcpError: '',
	isLoadingMCPInfo: false,
	mcpInfoError: null,
	isAddingMCP: false,
	hasSavedMCP: false,
	mcpServers: [],
}

export default function useMcpHook() {
	const { payload, setPayload } = useChatContext();
	const [mcpServers, setMcpServers] = useState<any[] | null>(INIT_MCP_STATE.mcpServers);
	const [mcpCode, setMcpCode] = useState(INIT_MCP_STATE.mcpCode);
	const [mcpError, setMcpError] = useState(INIT_MCP_STATE.mcpError);
	const [isAddingMCP, setIsAddingMCP] = useState(INIT_MCP_STATE.isAddingMCP);
	const [hasSavedMCP, setHasSavedMCP] = useState(INIT_MCP_STATE.hasSavedMCP);
	const [mcpInfo, setMcpInfo] = useState<any[] | null>(INIT_MCP_STATE.mcpInfo);
  const [isLoadingMCPInfo, setIsLoadingMCPInfo] = useState(INIT_MCP_STATE.isLoadingMCPInfo);
  const [mcpInfoError, setMcpInfoError] = useState<string | null>(INIT_MCP_STATE.mcpInfoError);

	// Function to fetch MCP info
	const fetchMCPInfo = useCallback(async () => {
		if (!mcpCode) return;
		
		try {
			setIsLoadingMCPInfo(true);
			setMcpInfoError(null);
			
			let mcpConfig;
			try {
				mcpConfig = JSON.parse(mcpCode);
			} catch (e) {
				setMcpInfoError("Invalid JSON configuration");
				return;
			}
			
			try {
				const response = await apiClient.post('/tools/mcp/info', { 
					mcp: mcpConfig 
				});
				
				setMcpInfo(response.data.mcp);
			} catch (apiError: any) {
				throw new Error(`Error fetching MCP info: ${apiError.message}`);
			}
		} catch (error: unknown) {
			setMcpInfoError(error instanceof Error ? error.message : 'An unknown error occurred');
		} finally {
			setIsLoadingMCPInfo(false);
		}
	}, [mcpCode])

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
      setMcpCode(INIT_MCP_STATE.mcpCode);
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
    setMcpCode(INIT_MCP_STATE.mcpCode);
    
    // If removing while in edit mode, we'll keep it open
    if (!isAddingMCP) {
      setIsAddingMCP(false);
    }
  };

	const fetchMCPServers = async () => {
		const response = await listPublicServers();
		setMcpServers(response.data.servers);
	}

	const useLoadMCPFromPayloadEffect = () => {
		useEffect(() => {
			if (payload.mcp) {
				setMcpCode(JSON.stringify(payload.mcp, null, 2));
				setHasSavedMCP(true);
			}
			return () => {
				setMcpCode(INIT_MCP_STATE.mcpCode);
				setHasSavedMCP(false);
			}
			
		}, [payload.mcp]);
	}

	// Reset mcpInfo when MCP configuration is removed
  const handleRemoveMCPConfig = () => {
    setMcpInfo(null);
    removeMCPConfig();
  };

	const useMCPInfoEffect = () => {
		// Fetch MCP info when entering MCP editor mode
		useEffect(() => {
			if (isAddingMCP && hasSavedMCP) {
				fetchMCPInfo();
			}
		}, [isAddingMCP, hasSavedMCP, fetchMCPInfo]);
	}

	const useMCPServersEffect = () => {
		useEffect(() => {
			fetchMCPServers();
		}, []);
	}
    
	return {
		mcpInfo,
		setMcpInfo,
		mcpCode,
		setMcpCode,
		isLoadingMCPInfo,
		setIsLoadingMCPInfo,
		mcpInfoError,
		setMcpInfoError,
		isAddingMCP,
		setIsAddingMCP,
		hasSavedMCP,
		setHasSavedMCP,
		mcpError,
		setMcpError,
		mcpServers,
		setMcpServers,
		// Actions
		fetchMCPInfo,
		startAddingMCP,
		cancelAddingMCP,
		saveMCPConfig,
		removeMCPConfig,
		// Effects
		useLoadMCPFromPayloadEffect,
		useMCPInfoEffect,
		handleRemoveMCPConfig,
		useMCPServersEffect,
	}
}