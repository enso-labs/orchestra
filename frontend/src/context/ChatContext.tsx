import { useContext, createContext, useEffect, useRef } from "react";
import useConfigHook from "@/hooks/useConfigHook";
import useImageHook from "@/hooks/useImageHook";
import useChat from "@/hooks/useChat";
import useThread from "@/hooks/useThread";
import useModel from "@/hooks/useModel";
import useFileSystem, { type FileData } from "@/hooks/useFileSystem";

// Re-export FileData type for consumers
export type { FileData, FileSystemState, FileSystemActions } from "@/hooks/useFileSystem";

export const ChatContext = createContext({});
export default function ChatProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const modelsHooks = useModel();
	const chatHooks = useChat();
	const imageHooks = useImageHook();
	const configHooks = useConfigHook();
	const threadHooks = useThread();
	const fileSystemHooks = useFileSystem();

	// Track previous filesMap size to detect changes
	const prevFilesMapRef = useRef<Map<string, unknown>>(new Map());

	// Sync filesMap (legacy nested structure) → fileSystem (flat structure)
	// This bridges the SSE handler output to the new fileSystem state
	useEffect(() => {
		const { filesMap } = chatHooks;
		const { importFiles, fileSystem } = fileSystemHooks;

		// Skip if filesMap hasn't changed
		if (filesMap === prevFilesMapRef.current) return;
		prevFilesMapRef.current = filesMap;

		// Flatten the nested filesMap structure into path-keyed Map
		const flatFiles = new Map<string, FileData>();
		const now = new Date().toISOString();

		filesMap.forEach((messageFiles: Record<string, unknown>, messageId: string) => {
			if (!messageFiles || typeof messageFiles !== "object") return;

			Object.entries(messageFiles).forEach(([path, data]: [string, unknown]) => {
				// Skip if already in fileSystem (don't overwrite user edits)
				if (fileSystem.has(path)) return;

				const fileData = data as { content?: string | string[]; created_at?: string; modified_at?: string };
				flatFiles.set(path, {
					content: Array.isArray(fileData.content) 
						? fileData.content 
						: (typeof fileData.content === "string" ? fileData.content.split("\n") : []),
					created_at: fileData.created_at || now,
					modified_at: fileData.modified_at || now,
					source: messageId,
				});
			});
		});

		// Import new files if any
		if (flatFiles.size > 0) {
			importFiles(flatFiles);
		}
	}, [chatHooks.filesMap, fileSystemHooks]);

	// Clear fileSystem when messages are cleared
	useEffect(() => {
		if (chatHooks.messages.length === 0) {
			fileSystemHooks.clearFileSystem();
		}
	}, [chatHooks.messages.length, fileSystemHooks]);

	return (
		<ChatContext.Provider
			value={{
				...chatHooks,
				...configHooks,
				...imageHooks,
				...threadHooks,
				...modelsHooks,
				...fileSystemHooks,
			}}
		>
			{children}
		</ChatContext.Provider>
	);
}

export function useChatContext(): any {
	return useContext(ChatContext);
}
