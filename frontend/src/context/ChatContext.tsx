import {
	useContext,
	createContext,
	useCallback,
	useEffect,
	useRef,
} from "react";
import useConfigHook from "@/hooks/useConfigHook";
import useImageHook from "@/hooks/useImageHook";
import useChat from "@/hooks/useChat";
import useThread from "@/hooks/useThread";
import useModel from "@/hooks/useModel";
import useFileSystem, { type FileData } from "@/hooks/useFileSystem";
import useMessageQueue from "@/hooks/useMessageQueue";
import MemoryService from "@/lib/services/memoryService";

// Re-export FileData type for consumers
export type {
	FileData,
	FileSystemState,
	FileSystemActions,
} from "@/hooks/useFileSystem";

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

	// Message queue for queueing messages during streaming
	const queueHooks = useMessageQueue({
		isStreaming: !!chatHooks.controller,
		executeSubmit: chatHooks.handleSubmit,
	});

	// Track previous filesMap to detect changes
	const prevFilesMapRef = useRef<Map<string, unknown>>(new Map());

	// Destructure stable references needed for the sync effect
	const { filesMap } = chatHooks;
	const { importFiles, dirtyFiles } = fileSystemHooks;

	// Sync filesMap (legacy nested structure) → fileSystem (flat structure)
	// This bridges the SSE handler output to the new fileSystem state
	useEffect(() => {
		// Skip if filesMap hasn't changed
		if (filesMap === prevFilesMapRef.current) return;
		prevFilesMapRef.current = filesMap;

		// Flatten the nested filesMap structure into path-keyed Map
		const flatFiles = new Map<string, FileData>();
		const now = new Date().toISOString();

		filesMap.forEach(
			(messageFiles: Record<string, unknown>, messageId: string) => {
				if (!messageFiles || typeof messageFiles !== "object") return;

				Object.entries(messageFiles).forEach(
					([path, data]: [string, unknown]) => {
						// Skip only user-modified files (dirty), allow SSE to update non-dirty existing files
						if (dirtyFiles.has(path)) return;

						const fileData = data as {
							content?: string | string[];
							created_at?: string;
							modified_at?: string;
						};
						flatFiles.set(path, {
							content: Array.isArray(fileData.content)
								? fileData.content
								: typeof fileData.content === "string"
									? fileData.content.split("\n")
									: [],
							created_at: fileData.created_at || now,
							modified_at: fileData.modified_at || now,
							source: messageId,
						});
					},
				);
			},
		);

		// Import new files if any
		if (flatFiles.size > 0) {
			importFiles(flatFiles);
		}
	}, [filesMap, importFiles, dirtyFiles]);

	// Destructure for the reverse sync and clear effects
	const { clearFileSystem, fileSystem } = fileSystemHooks;
	const { setFilesMap } = chatHooks;
	const messagesLength = chatHooks.messages.length;

	// Track previous fileSystem to detect user-initiated changes
	const prevFileSystemRef = useRef<Map<string, FileData>>(new Map());

	// Reverse sync: fileSystem → filesMap
	// This ensures user-created files in FileEditorPanel are included in API submissions
	useEffect(() => {
		// Skip if fileSystem hasn't changed
		if (fileSystem === prevFileSystemRef.current) return;
		prevFileSystemRef.current = fileSystem;

		// Convert fileSystem entries to filesMap format under __user_files__ key
		// Only sync files that don't have a source (i.e., user-created, not from SSE)
		const userFiles: Record<string, FileData> = {};
		fileSystem.forEach((data, path) => {
			// Include user-created files. Consider also including user-edited sourced files
			// (e.g. dirty) if submissions still read from filesMap.
			if (!data.source || data.source === "__user_files__") {
				userFiles[path] = data;
			}
		});

		// Always reconcile __user_files__ to avoid stale submissions
		const hasUserFiles = Object.keys(userFiles).length > 0;
		const prevHasKey = filesMap.has("__user_files__");

		// No user files: drop the key if it exists; otherwise no-op.
		if (!hasUserFiles) {
			if (prevHasKey) {
				const next = new Map(filesMap);
				next.delete("__user_files__");
				setFilesMap(next);
			}
			return;
		}

		// Deep equality check to avoid unnecessary state updates
		const currentUserFiles = filesMap.get("__user_files__");
		if (currentUserFiles) {
			const newKeys = Object.keys(userFiles);
			const currentKeys = Object.keys(currentUserFiles);
			if (newKeys.length === currentKeys.length) {
				const isEqual = newKeys.every((key) => {
					const newFile = userFiles[key];
					const currentFile = currentUserFiles[key];
					if (!currentFile) return false;
					return (
						newFile.created_at === currentFile.created_at &&
						newFile.modified_at === currentFile.modified_at &&
						newFile.source === currentFile.source &&
						newFile.content.length === currentFile.content.length &&
						newFile.content.every((line, i) => line === currentFile.content[i])
					);
				});
				if (isEqual) return; // No-op: userFiles unchanged
			}
		}

		// Ensure __user_files__ is last so it overwrites on path collisions during merging.
		const next = new Map(filesMap);
		next.delete("__user_files__");
		next.set("__user_files__", userFiles);
		setFilesMap(next);
	}, [fileSystem, filesMap, setFilesMap]);

	// Destructure clearQueue for the clear effect
	const { clearQueue } = queueHooks;

	// Shared helper: fetch memory files from the API and import them
	const loadMemoryFiles = useCallback(async () => {
		try {
			const memoryFiles = await MemoryService.getFiles();
			if (memoryFiles && Object.keys(memoryFiles).length > 0) {
				const now = new Date().toISOString();
				const files = new Map(
					Object.entries(memoryFiles).map(([path, fileData]) => {
						const raw = fileData.content as string[] | string | undefined;
						return [
							path,
							{
								...fileData,
								content: Array.isArray(raw)
									? raw
									: typeof raw === "string"
										? raw.split("\n")
										: [],
								created_at: fileData.created_at || now,
								modified_at: fileData.modified_at || now,
							},
						];
					}),
				);
				importFiles(files);
			}
		} catch (error) {
			console.error("Failed to load memory files:", error);
		}
	}, [importFiles]);

	// Clear fileSystem and queue when messages are cleared
	useEffect(() => {
		if (messagesLength === 0) {
			clearFileSystem();
			clearQueue();
		}
	}, [messagesLength, clearFileSystem, clearQueue]);

	// Load memory files into filesystem — called from pages that require auth
	const useMemoryFilesEffect = () => {
		useEffect(() => {
			loadMemoryFiles();
		}, []);
	};

	return (
		<ChatContext.Provider
			value={{
				...chatHooks,
				...configHooks,
				...imageHooks,
				...threadHooks,
				...modelsHooks,
				...fileSystemHooks,
				...queueHooks,
				useMemoryFilesEffect,
				loadMemoryFiles,
			}}
		>
			{children}
		</ChatContext.Provider>
	);
}

export function useChatContext(): any {
	return useContext(ChatContext);
}
