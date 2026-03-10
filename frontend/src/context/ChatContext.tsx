import {
	useContext,
	createContext,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import useConfigHook from "@/hooks/useConfigHook";
import useImageHook from "@/hooks/useImageHook";
import useChat from "@/hooks/useChat";
import useThread from "@/hooks/useThread";
import useModel from "@/hooks/useModel";
import useFileSystem, { type FileData } from "@/hooks/useFileSystem";
import useMessageQueue from "@/hooks/useMessageQueue";
import MemoryService from "@/lib/services/memoryService";
import {
	getSettings,
	patchDefaults,
	type PersistedContextFile,
} from "@/lib/services/userSettingsService";
import { getAuthToken } from "@/lib/utils/auth";
import { toast } from "sonner";

export type {
	FileData,
	FileSystemState,
	FileSystemActions,
} from "@/hooks/useFileSystem";

const CONTEXT_FILES_KEY = "__context_files__";
export const PERSISTENT_SETTINGS_SOURCE = "__persistent_settings__";
export const MEMORY_FILES_SOURCE = "__memory_files__";
export const USER_FILES_SOURCE = "__user_files__";
export const BACKEND_SYNC_SOURCE = "__backend_sync__";

const NON_THREAD_SCOPED_SOURCES = new Set<string>([
	PERSISTENT_SETTINGS_SOURCE,
	MEMORY_FILES_SOURCE,
	USER_FILES_SOURCE,
	BACKEND_SYNC_SOURCE,
]);

const normalizeFileContent = (
	content: string[] | string | undefined,
): string[] => {
	if (Array.isArray(content)) {
		return content;
	}
	if (typeof content === "string") {
		return content.split("\n");
	}
	return [];
};

type NormalizableFileData = {
	content?: string[] | string;
	created_at?: string | null;
	modified_at?: string | null;
	source?: string;
};

const normalizeFileData = (
	fileData: NormalizableFileData,
	source?: string,
): FileData => {
	const now = new Date().toISOString();
	return {
		content: normalizeFileContent(fileData.content),
		created_at: fileData.created_at || now,
		modified_at: fileData.modified_at || now,
		...(source ? { source } : {}),
	};
};

const fileRecordsEqual = (
	left: Record<string, FileData>,
	right?: Record<string, FileData>,
): boolean => {
	if (!right) {
		return false;
	}

	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) {
		return false;
	}

	return leftKeys.every((path) => {
		const leftFile = left[path];
		const rightFile = right[path];
		if (!rightFile) {
			return false;
		}

		return (
			leftFile.created_at === rightFile.created_at &&
			leftFile.modified_at === rightFile.modified_at &&
			leftFile.content.length === rightFile.content.length &&
			leftFile.content.every((line, index) => line === rightFile.content[index])
		);
	});
};

const mergeFileMaps = (
	...maps: Map<string, FileData>[]
): Map<string, FileData> => {
	const next = new Map<string, FileData>();
	for (const map of maps) {
		map.forEach((file, path) => {
			next.set(path, file);
		});
	}
	return next;
};

const buildPersistentPayload = (
	settingsFiles: Map<string, FileData>,
	baselineOverrides: Map<string, FileData>,
) => {
	const files: Record<string, PersistedContextFile> = {};
	const persistedFiles = mergeFileMaps(settingsFiles, baselineOverrides);

	persistedFiles.forEach((file, path) => {
		files[path] = {
			content: [...file.content],
			created_at: file.created_at,
			modified_at: file.modified_at,
		};
	});

	return {
		files,
		deleted_files: [] as string[],
	};
};

const isPathDescendant = (path: string, prefix: string): boolean => {
	const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
	return path.startsWith(normalizedPrefix);
};

const isThreadScopedSource = (source?: string): boolean =>
	Boolean(source && !NON_THREAD_SCOPED_SOURCES.has(source));

const promoteToUserFile = (
	file: FileData,
	overrides: Partial<FileData> = {},
): FileData => ({
	...file,
	...overrides,
	source: USER_FILES_SOURCE,
});

type SavePersistentContextFilesOptions = {
	reason?: "manual" | "autosave";
	showSuccessToast?: boolean;
	force?: boolean;
};

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

	const queueHooks = useMessageQueue({
		isStreaming: !!chatHooks.controller,
		executeSubmit: chatHooks.handleSubmit,
	});

	const prevFilesMapRef = useRef<Map<string, unknown>>(new Map());
	const autosaveSkipCountRef = useRef(0);
	const lastSavedPersistentSignatureRef = useRef<string | null>(null);
	const persistentContextLoadedRef = useRef(false);
	const persistentSaveTimerRef = useRef<number | null>(null);
	const persistentSaveInFlightRef = useRef(false);
	const isAuthenticated = Boolean(getAuthToken());

	const { filesMap } = chatHooks;
	const {
		fileSystem,
		dirtyFiles,
		markClean,
		clearFileSystem: baseClearFileSystem,
		createFile: baseCreateFile,
		updateFile: baseUpdateFile,
		deleteFile: baseDeleteFile,
		renameFile: baseRenameFile,
		syncFiles,
	} = fileSystemHooks;
	const { setFilesMap } = chatHooks;

	const fileSystemRef = useRef(fileSystem);
	const dirtyFilesRef = useRef(dirtyFiles);
	const isStreamingRef = useRef(!!chatHooks.controller);
	const settingsFilesRef = useRef(new Map<string, FileData>());
	const memoryFilesRef = useRef(new Map<string, FileData>());
	const baselineOverridesRef = useRef(new Map<string, FileData>());
	const backendSyncFilesRef = useRef(new Map<string, FileData>());
	const threadScopedFilesRef = useRef(new Map<string, FileData>());

	const [settingsFiles, setSettingsFiles] = useState<Map<string, FileData>>(
		() => new Map(),
	);
	const [memoryFiles, setMemoryFiles] = useState<Map<string, FileData>>(
		() => new Map(),
	);
	const [baselineOverrides, setBaselineOverrides] = useState<
		Map<string, FileData>
	>(() => new Map());
	const [backendSyncFiles, setBackendSyncFiles] = useState<
		Map<string, FileData>
	>(() => new Map());
	const [threadScopedFiles, setThreadScopedFiles] = useState<
		Map<string, FileData>
	>(() => new Map());

	fileSystemRef.current = fileSystem;
	dirtyFilesRef.current = dirtyFiles;
	isStreamingRef.current = !!chatHooks.controller;
	settingsFilesRef.current = settingsFiles;
	memoryFilesRef.current = memoryFiles;
	baselineOverridesRef.current = baselineOverrides;
	backendSyncFilesRef.current = backendSyncFiles;
	threadScopedFilesRef.current = threadScopedFiles;

	const runWithPersistentSyncSuspended = useCallback((callback: () => void) => {
		autosaveSkipCountRef.current += 1;
		callback();
	}, []);

	const hydrateFilesMap = useCallback(
		(nextFilesMap: Map<string, any>) => {
			autosaveSkipCountRef.current += 1;
			setFilesMap(nextFilesMap);
		},
		[setFilesMap],
	);

	const getVisibleWorkspaceFiles = useCallback(() => {
		return mergeFileMaps(
			memoryFilesRef.current,
			settingsFilesRef.current,
			backendSyncFilesRef.current,
			baselineOverridesRef.current,
			threadScopedFilesRef.current,
		);
	}, []);

	const removePathFromAllSources = useCallback((path: string) => {
		setSettingsFiles((prev) => {
			if (!prev.has(path)) {
				return prev;
			}
			const next = new Map(prev);
			next.delete(path);
			return next;
		});
		setMemoryFiles((prev) => {
			if (!prev.has(path)) {
				return prev;
			}
			const next = new Map(prev);
			next.delete(path);
			return next;
		});
		setBaselineOverrides((prev) => {
			if (!prev.has(path)) {
				return prev;
			}
			const next = new Map(prev);
			next.delete(path);
			return next;
		});
		setBackendSyncFiles((prev) => {
			if (!prev.has(path)) {
				return prev;
			}
			const next = new Map(prev);
			next.delete(path);
			return next;
		});
		setThreadScopedFiles((prev) => {
			if (!prev.has(path)) {
				return prev;
			}
			const next = new Map(prev);
			next.delete(path);
			return next;
		});
	}, []);

	const loadPersistentContextFiles = useCallback(async () => {
		if (!isAuthenticated) {
			persistentContextLoadedRef.current = true;
			lastSavedPersistentSignatureRef.current = JSON.stringify(
				buildPersistentPayload(
					settingsFilesRef.current,
					baselineOverridesRef.current,
				),
			);
			return;
		}

		try {
			const [settings, memoryFilesResponse] = await Promise.all([
				getSettings(),
				MemoryService.getFiles(),
			]);
			const persistedFiles = settings.defaults.files || {};
			const nextSettingsFiles = new Map<string, FileData>();
			const nextMemoryFiles = new Map<string, FileData>();

			Object.entries(persistedFiles).forEach(([path, fileData]) => {
				nextSettingsFiles.set(
					path,
					normalizeFileData(fileData, PERSISTENT_SETTINGS_SOURCE),
				);
			});

			Object.entries(memoryFilesResponse || {}).forEach(([path, fileData]) => {
				nextMemoryFiles.set(
					path,
					normalizeFileData(fileData, MEMORY_FILES_SOURCE),
				);
			});

			autosaveSkipCountRef.current += 1;
			setSettingsFiles(nextSettingsFiles);
			setMemoryFiles(nextMemoryFiles);
			persistentContextLoadedRef.current = true;
			lastSavedPersistentSignatureRef.current = JSON.stringify(
				buildPersistentPayload(nextSettingsFiles, baselineOverridesRef.current),
			);
		} catch (error) {
			persistentContextLoadedRef.current = true;
			console.error("Failed to load persistent context files:", error);
		}
	}, [isAuthenticated]);

	useEffect(() => {
		void loadPersistentContextFiles();
	}, [loadPersistentContextFiles]);

	useEffect(() => {
		const nextVisibleFiles = mergeFileMaps(
			memoryFiles,
			settingsFiles,
			backendSyncFiles,
			baselineOverrides,
			threadScopedFiles,
		);

		syncFiles(nextVisibleFiles, {
			openNewTabs: true,
			resetDirtyFiles: false,
		});
	}, [
		memoryFiles,
		settingsFiles,
		backendSyncFiles,
		baselineOverrides,
		threadScopedFiles,
		syncFiles,
	]);

	useEffect(() => {
		if (filesMap === prevFilesMapRef.current) {
			return;
		}
		prevFilesMapRef.current = filesMap;

		const nextThreadFiles = new Map<string, FileData>();
		filesMap.forEach(
			(messageFiles: Record<string, unknown>, messageId: string) => {
				if (messageId === CONTEXT_FILES_KEY) {
					return;
				}
				if (!messageFiles || typeof messageFiles !== "object") {
					return;
				}

				Object.entries(messageFiles).forEach(
					([path, data]: [string, unknown]) => {
						if (dirtyFilesRef.current.has(path)) {
							return;
						}
						if (
							settingsFilesRef.current.has(path) ||
							baselineOverridesRef.current.has(path) ||
							backendSyncFilesRef.current.has(path)
						) {
							return;
						}

						const fileData = data as {
							content?: string | string[];
							created_at?: string;
							modified_at?: string;
						};
						nextThreadFiles.set(path, normalizeFileData(fileData, messageId));
					},
				);
			},
		);

		setThreadScopedFiles(nextThreadFiles);
	}, [filesMap]);

	const messagesLength = chatHooks.messages.length;
	const isStreaming = !!chatHooks.controller;
	const prevFileSystemRef = useRef<Map<string, FileData>>(new Map());

	useEffect(() => {
		if (fileSystem === prevFileSystemRef.current) {
			return;
		}
		prevFileSystemRef.current = fileSystem;

		const contextFiles: Record<string, FileData> = {};
		fileSystem.forEach((data, path) => {
			contextFiles[path] = {
				content: [...data.content],
				created_at: data.created_at,
				modified_at: data.modified_at,
			};
		});

		const hasContextFiles = Object.keys(contextFiles).length > 0;
		const prevContextFiles = filesMap.get(CONTEXT_FILES_KEY) as
			| Record<string, FileData>
			| undefined;

		if (!hasContextFiles) {
			if (!filesMap.has(CONTEXT_FILES_KEY)) {
				return;
			}
			const next = new Map(filesMap);
			next.delete(CONTEXT_FILES_KEY);
			setFilesMap(next);
			return;
		}

		if (fileRecordsEqual(contextFiles, prevContextFiles)) {
			return;
		}

		const next = new Map(filesMap);
		next.delete(CONTEXT_FILES_KEY);
		next.set(CONTEXT_FILES_KEY, contextFiles);
		setFilesMap(next);
	}, [fileSystem, filesMap, setFilesMap]);

	const { clearQueue } = queueHooks;

	useEffect(() => {
		if (messagesLength === 0) {
			clearQueue();
		}
	}, [messagesLength, clearQueue]);

	const getPersistentPayloadSnapshot = useCallback(() => {
		const payload = buildPersistentPayload(
			settingsFilesRef.current,
			baselineOverridesRef.current,
		);

		return {
			payload,
			signature: JSON.stringify(payload),
		};
	}, []);

	const { signature: persistentPayloadSignature } =
		getPersistentPayloadSnapshot();
	const hasUnsavedPersistentChanges =
		isAuthenticated &&
		persistentContextLoadedRef.current &&
		autosaveSkipCountRef.current === 0 &&
		persistentPayloadSignature !== lastSavedPersistentSignatureRef.current;

	const savePersistentContextFiles = useCallback(
		async (
			options: SavePersistentContextFilesOptions = {},
		): Promise<boolean> => {
			const { reason = "autosave", showSuccessToast = false } = options;

			if (!isAuthenticated || !persistentContextLoadedRef.current) {
				return false;
			}

			if (autosaveSkipCountRef.current > 0) {
				return false;
			}

			if (reason !== "manual" && isStreamingRef.current) {
				return false;
			}

			if (persistentSaveInFlightRef.current) {
				return false;
			}

			if (persistentSaveTimerRef.current) {
				window.clearTimeout(persistentSaveTimerRef.current);
				persistentSaveTimerRef.current = null;
			}

			const { payload, signature } = getPersistentPayloadSnapshot();
			if (signature === lastSavedPersistentSignatureRef.current) {
				return false;
			}

			const dirtyPaths = Array.from(dirtyFilesRef.current);

			persistentSaveInFlightRef.current = true;
			try {
				await patchDefaults(payload);

				const nextPersistedFiles = new Map<string, FileData>();
				Object.entries(payload.files).forEach(([path, fileData]) => {
					nextPersistedFiles.set(
						path,
						normalizeFileData(fileData, PERSISTENT_SETTINGS_SOURCE),
					);
				});

				setSettingsFiles(nextPersistedFiles);
				setBaselineOverrides(new Map());
				lastSavedPersistentSignatureRef.current = signature;
				dirtyPaths.forEach((path) => {
					markClean(path);
				});

				if (showSuccessToast) {
					toast.success("Changes saved");
				}

				return true;
			} catch (error) {
				console.error("Failed to persist context files:", error);
				toast.error("Failed to save context files");
				return false;
			} finally {
				persistentSaveInFlightRef.current = false;
			}
		},
		[getPersistentPayloadSnapshot, isAuthenticated, markClean],
	);

	useEffect(() => {
		if (
			!isAuthenticated ||
			!persistentContextLoadedRef.current ||
			isStreaming
		) {
			return;
		}

		if (autosaveSkipCountRef.current > 0) {
			autosaveSkipCountRef.current -= 1;
			lastSavedPersistentSignatureRef.current = persistentPayloadSignature;
			return;
		}

		if (
			persistentPayloadSignature === lastSavedPersistentSignatureRef.current
		) {
			return;
		}

		if (persistentSaveTimerRef.current) {
			window.clearTimeout(persistentSaveTimerRef.current);
		}

		persistentSaveTimerRef.current = window.setTimeout(() => {
			persistentSaveTimerRef.current = null;
			void savePersistentContextFiles({
				reason: "autosave",
				showSuccessToast: false,
			});
		}, 500);

		return () => {
			if (persistentSaveTimerRef.current) {
				window.clearTimeout(persistentSaveTimerRef.current);
			}
		};
	}, [
		isAuthenticated,
		isStreaming,
		persistentPayloadSignature,
		savePersistentContextFiles,
	]);

	const createFile = useCallback(
		(path: string, content?: string) => {
			const fileData = normalizeFileData(
				{
					content: content ?? "",
				},
				USER_FILES_SOURCE,
			);

			baseCreateFile(path, content);
			setBaselineOverrides((prev) => {
				const next = new Map(prev);
				next.set(path, fileData);
				return next;
			});
		},
		[baseCreateFile],
	);

	const updateFile = useCallback(
		(path: string, content: string) => {
			const existing = fileSystemRef.current.get(path);
			if (!existing) {
				return;
			}

			const nextFile = {
				...existing,
				content: content.split("\n"),
				modified_at: new Date().toISOString(),
			};

			baseUpdateFile(path, content);

			if (existing.source === PERSISTENT_SETTINGS_SOURCE) {
				setSettingsFiles((prev) => {
					const next = new Map(prev);
					next.set(path, {
						...nextFile,
						source: PERSISTENT_SETTINGS_SOURCE,
					});
					return next;
				});
				return;
			}

			if (existing.source === USER_FILES_SOURCE) {
				setBaselineOverrides((prev) => {
					const next = new Map(prev);
					next.set(path, {
						...nextFile,
						source: USER_FILES_SOURCE,
					});
					return next;
				});
				return;
			}

			if (existing.source === MEMORY_FILES_SOURCE) {
				setMemoryFiles((prev) => {
					const next = new Map(prev);
					next.delete(path);
					return next;
				});
				setBaselineOverrides((prev) => {
					const next = new Map(prev);
					next.set(path, promoteToUserFile(nextFile));
					return next;
				});
				return;
			}

			if (existing.source === BACKEND_SYNC_SOURCE) {
				setBackendSyncFiles((prev) => {
					const next = new Map(prev);
					next.set(path, {
						...nextFile,
						source: BACKEND_SYNC_SOURCE,
					});
					return next;
				});
				return;
			}

			if (isThreadScopedSource(existing.source)) {
				setThreadScopedFiles((prev) => {
					const next = new Map(prev);
					next.delete(path);
					return next;
				});
				setBaselineOverrides((prev) => {
					const next = new Map(prev);
					next.set(path, promoteToUserFile(nextFile));
					return next;
				});
			}
		},
		[baseUpdateFile],
	);

	const deletePath = useCallback(
		(path: string) => {
			const matches = Array.from(getVisibleWorkspaceFiles().keys()).filter(
				(currentPath) =>
					currentPath === path || isPathDescendant(currentPath, path),
			);

			if (matches.length === 0) {
				return;
			}

			matches.forEach((matchedPath) => {
				baseDeleteFile(matchedPath);
				removePathFromAllSources(matchedPath);
			});
		},
		[baseDeleteFile, getVisibleWorkspaceFiles, removePathFromAllSources],
	);

	const deleteFile = useCallback(
		(path: string) => {
			deletePath(path);
		},
		[deletePath],
	);

	const renameFile = useCallback(
		(oldPath: string, newPath: string) => {
			const existing = fileSystemRef.current.get(oldPath);
			if (!existing) {
				return;
			}

			baseRenameFile(oldPath, newPath);

			const renamedFile = {
				...existing,
				modified_at: new Date().toISOString(),
			};

			if (existing.source === PERSISTENT_SETTINGS_SOURCE) {
				setSettingsFiles((prev) => {
					const next = new Map(prev);
					next.delete(oldPath);
					next.set(newPath, {
						...renamedFile,
						source: PERSISTENT_SETTINGS_SOURCE,
					});
					return next;
				});
				return;
			}

			if (existing.source === USER_FILES_SOURCE) {
				setBaselineOverrides((prev) => {
					const next = new Map(prev);
					next.delete(oldPath);
					next.set(newPath, {
						...renamedFile,
						source: USER_FILES_SOURCE,
					});
					return next;
				});
				return;
			}

			if (existing.source === BACKEND_SYNC_SOURCE) {
				setBackendSyncFiles((prev) => {
					const next = new Map(prev);
					next.delete(oldPath);
					next.set(newPath, {
						...renamedFile,
						source: BACKEND_SYNC_SOURCE,
					});
					return next;
				});
				return;
			}

			if (existing.source === MEMORY_FILES_SOURCE) {
				setMemoryFiles((prev) => {
					const next = new Map(prev);
					next.delete(oldPath);
					return next;
				});
			}

			if (isThreadScopedSource(existing.source)) {
				setThreadScopedFiles((prev) => {
					const next = new Map(prev);
					next.delete(oldPath);
					return next;
				});
			}

			setBaselineOverrides((prev) => {
				const next = new Map(prev);
				next.delete(oldPath);
				next.set(newPath, promoteToUserFile(renamedFile));
				return next;
			});
		},
		[baseRenameFile],
	);

	const clearThreadScopedFiles = useCallback(() => {
		setThreadScopedFiles(new Map());
		hydrateFilesMap(new Map());
	}, [hydrateFilesMap]);

	const clearBackendSyncFiles = useCallback(() => {
		setBackendSyncFiles(new Map());
	}, []);

	const clearFileSystem = useCallback(() => {
		setSettingsFiles(new Map());
		setMemoryFiles(new Map());
		setBaselineOverrides(new Map());
		setBackendSyncFiles(new Map());
		setThreadScopedFiles(new Map());
		baseClearFileSystem();
		hydrateFilesMap(new Map());
	}, [baseClearFileSystem, hydrateFilesMap]);

	const fromBackendFormat = useCallback((data: Record<string, string>) => {
		if (!data || Object.keys(data).length === 0) {
			setBackendSyncFiles(new Map());
			return;
		}

		const nextFiles = new Map<string, FileData>();
		Object.entries(data).forEach(([path, content]) => {
			nextFiles.set(
				path,
				normalizeFileData(
					{
						content,
					},
					BACKEND_SYNC_SOURCE,
				),
			);
		});

		setBackendSyncFiles(nextFiles);
	}, []);

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
				createFile,
				updateFile,
				deleteFile,
				deletePath,
				renameFile,
				clearFileSystem,
				fromBackendFormat,
				deletedFiles: [],
				hasUnsavedPersistentChanges,
				savePersistentContextFiles,
				setFilesMap: hydrateFilesMap,
				loadPersistentContextFiles,
				runWithPersistentSyncSuspended,
				clearThreadScopedFiles,
				clearBackendSyncFiles,
			}}
		>
			{children}
		</ChatContext.Provider>
	);
}

export function useChatContext(): any {
	return useContext(ChatContext);
}
