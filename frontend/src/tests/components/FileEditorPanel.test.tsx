import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook, act } from "@testing-library/react";

// Mock the ChatContext
const mockChatContext = {
	fileSystem: new Map([
		[
			"/test.txt",
			{
				content: ["test content"],
				created_at: "2024-01-01",
				modified_at: "2024-01-01",
			},
		],
	]),
	openTabs: ["/test.txt"],
	activeFile: "/test.txt",
	dirtyFiles: new Set<string>(),
	createFile: vi.fn(),
	updateFile: vi.fn(),
	deleteFile: vi.fn(),
	renameFile: vi.fn(),
	closeTab: vi.fn(),
	selectTab: vi.fn(),
	markDirty: vi.fn(),
	markClean: vi.fn(),
	setViewMode: vi.fn(),
};

vi.mock("@/context/ChatContext", () => ({
	useChatContext: () => mockChatContext,
}));

// Mock react-voice-visualizer
vi.mock("react-voice-visualizer", () => ({
	useVoiceVisualizer: () => ({
		startRecording: vi.fn(),
		stopRecording: vi.fn(),
		isRecordingInProgress: false,
		recordedBlob: null,
	}),
	VoiceVisualizer: () => null,
}));

// Mock API client
vi.mock("@/lib/utils/apiClient", () => ({
	default: {
		post: vi.fn().mockResolvedValue({
			data: { transcript: { text: "test transcript" } },
		}),
	},
}));

// Import useInferenceDictation after mocks
import useInferenceDictation from "@/hooks/useInferenceDictation";

describe("FileEditorPanel Inference Dictation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("useInferenceDictation hook integration", () => {
		it("should have inference mode toggle functionality", () => {
			const { result } = renderHook(() =>
				useInferenceDictation({
					activeFile: "/test.txt",
					fileContent: "test content",
				}),
			);

			// Initial state
			expect(result.current.inferenceMode).toBe(false);

			// Toggle on
			act(() => {
				result.current.toggleInferenceMode();
			});
			expect(result.current.inferenceMode).toBe(true);

			// Toggle off
			act(() => {
				result.current.toggleInferenceMode();
			});
			expect(result.current.inferenceMode).toBe(false);
		});

		it("should show Generate indicator when inference mode is active via buildPayload", () => {
			const { result } = renderHook(() =>
				useInferenceDictation({
					activeFile: "/test.txt",
					fileContent: "test content",
				}),
			);

			act(() => {
				result.current.setInferenceMode(true);
			});

			const payload = result.current.buildPayload("generate a function");

			expect(payload.generate_files).toBe(true);
			expect(payload.target_file).toBe("/test.txt");
			expect(payload.file_context).toBe("test content");
		});

		it("should send transcribed text to LLM when inference mode is active", () => {
			const { result } = renderHook(() =>
				useInferenceDictation({
					activeFile: "/test.txt",
					fileContent: "existing code",
				}),
			);

			act(() => {
				result.current.setInferenceMode(true);
			});

			const payload = result.current.buildPayload(
				"add error handling to this code",
			);

			expect(payload.input.messages[0].content).toBe(
				"add error handling to this code",
			);
			expect(payload.generate_files).toBe(true);
		});

		it("should include target_file in payload for file generation", () => {
			const { result } = renderHook(() =>
				useInferenceDictation({
					activeFile: "/src/main.py",
					fileContent: "def hello(): pass",
				}),
			);

			const payload = result.current.buildPayload("add docstring");

			expect(payload.target_file).toBe("/src/main.py");
		});

		it("should include file_context in payload for LLM context", () => {
			const fileContent = "function greet() { return 'hello'; }";
			const { result } = renderHook(() =>
				useInferenceDictation({
					activeFile: "/index.js",
					fileContent,
				}),
			);

			const payload = result.current.buildPayload("add TypeScript types");

			expect(payload.file_context).toBe(fileContent);
		});

		it("should track isGenerating state", () => {
			const { result } = renderHook(() => useInferenceDictation());

			expect(result.current.isGenerating).toBe(false);

			act(() => {
				result.current.setIsGenerating(true);
			});

			expect(result.current.isGenerating).toBe(true);

			act(() => {
				result.current.setIsGenerating(false);
			});

			expect(result.current.isGenerating).toBe(false);
		});
	});

	describe("Payload structure for file generation", () => {
		it("should create correct payload structure for LLM stream", () => {
			const { result } = renderHook(() =>
				useInferenceDictation({
					activeFile: "/app.py",
					fileContent: "# Python app",
				}),
			);

			const payload = result.current.buildPayload("create a flask app");

			expect(payload).toEqual({
				input: {
					messages: [
						{
							role: "user",
							content: "create a flask app",
						},
					],
				},
				generate_files: true,
				target_file: "/app.py",
				file_context: "# Python app",
			});
		});

		it("should create payload without target_file when no activeFile", () => {
			const { result } = renderHook(() => useInferenceDictation());

			const payload = result.current.buildPayload("create a new file");

			expect(payload).toEqual({
				input: {
					messages: [
						{
							role: "user",
							content: "create a new file",
						},
					],
				},
				generate_files: true,
			});
			expect(payload.target_file).toBeUndefined();
			expect(payload.file_context).toBeUndefined();
		});
	});
});
