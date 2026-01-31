import McpServerService from "@/lib/services/serverService";
import {
	McpServerConfig,
	McpServerCreate,
	McpServerUpdate,
	McpServerTestConnectionRequest,
	McpServerTestConnectionResponse,
	McpServerTool,
} from "@/lib/entities";
import { useEffect, useState } from "react";

export interface McpServerState {
	servers: McpServerConfig[];
	selectedServer: McpServerConfig | null;
	loading: boolean;
	error: string | null;
}

export const INIT_MCP_SERVER_STATE: McpServerState = {
	servers: [],
	selectedServer: null,
	loading: false,
	error: null,
};

export function useServer() {
	const [servers, setServers] = useState<McpServerConfig[]>([]);
	const [selectedServer, setSelectedServer] = useState<McpServerConfig | null>(
		null,
	);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleGetServers = async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await McpServerService.list();
			setServers(response.data || []);
		} catch (err: any) {
			setError(err.message || "Failed to fetch servers");
			console.error("Failed to fetch servers:", err);
		} finally {
			setLoading(false);
		}
	};

	const handleGetServer = async (
		serverId: string,
	): Promise<McpServerConfig | null> => {
		setLoading(true);
		setError(null);
		try {
			const response = await McpServerService.get(serverId);
			const server = response.data;
			setSelectedServer(server);
			return server;
		} catch (err: any) {
			setError(err.message || "Failed to fetch server");
			console.error("Failed to fetch server:", err);
			return null;
		} finally {
			setLoading(false);
		}
	};

	const handleCreateServer = async (
		server: McpServerCreate,
	): Promise<McpServerConfig | null> => {
		setLoading(true);
		setError(null);
		try {
			const response = await McpServerService.create(server);
			const newServer = response.data;
			setServers((prev) => [...prev, newServer]);
			return newServer;
		} catch (err: any) {
			setError(err.message || "Failed to create server");
			console.error("Failed to create server:", err);
			return null;
		} finally {
			setLoading(false);
		}
	};

	const handleUpdateServer = async (
		serverId: string,
		updates: McpServerUpdate,
	): Promise<McpServerConfig | null> => {
		setLoading(true);
		setError(null);
		try {
			const response = await McpServerService.update(serverId, updates);
			const updatedServer = response.data;
			setServers((prev) =>
				prev.map((s) => (s.id === serverId ? updatedServer : s)),
			);
			if (selectedServer?.id === serverId) {
				setSelectedServer(updatedServer);
			}
			return updatedServer;
		} catch (err: any) {
			setError(err.message || "Failed to update server");
			console.error("Failed to update server:", err);
			return null;
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteServer = async (serverId: string): Promise<boolean> => {
		setLoading(true);
		setError(null);
		try {
			await McpServerService.delete(serverId);
			setServers((prev) => prev.filter((s) => s.id !== serverId));
			if (selectedServer?.id === serverId) {
				setSelectedServer(null);
			}
			return true;
		} catch (err: any) {
			setError(err.message || "Failed to delete server");
			console.error("Failed to delete server:", err);
			return false;
		} finally {
			setLoading(false);
		}
	};

	const handleTestConnection = async (
		request: McpServerTestConnectionRequest,
	): Promise<McpServerTestConnectionResponse | null> => {
		setLoading(true);
		setError(null);
		try {
			const response = await McpServerService.testConnection(request);
			return response.data;
		} catch (err: any) {
			setError(err.message || "Failed to test connection");
			console.error("Failed to test connection:", err);
			return null;
		} finally {
			setLoading(false);
		}
	};

	const handleDiscoverTools = async (
		serverId: string,
	): Promise<McpServerTool[]> => {
		setLoading(true);
		setError(null);
		try {
			const response = await McpServerService.discoverTools(serverId);
			return response.data || [];
		} catch (err: any) {
			setError(err.message || "Failed to discover tools");
			console.error("Failed to discover tools:", err);
			return [];
		} finally {
			setLoading(false);
		}
	};

	const selectServer = (server: McpServerConfig | null) => {
		setSelectedServer(server);
	};

	const useEffectGetServers = () => {
		useEffect(() => {
			handleGetServers();
			return () => {
				setServers([]);
			};
		}, []);
	};

	return {
		servers,
		setServers,
		selectedServer,
		selectServer,
		loading,
		error,
		handleGetServers,
		handleGetServer,
		handleCreateServer,
		handleUpdateServer,
		handleDeleteServer,
		handleTestConnection,
		handleDiscoverTools,
		useEffectGetServers,
	};
}

export default useServer;
