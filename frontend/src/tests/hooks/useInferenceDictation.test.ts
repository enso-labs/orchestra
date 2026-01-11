import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useInferenceDictation from "@/hooks/useInferenceDictation";

describe("useInferenceDictation", () => {
	describe("initial state", () => {
		it("should have inference mode disabled by default", () => {
			const { result } = renderHook(() => useInferenceDictation());

			expect(result.current.inferenceMode).toBe(false);
		});

		it("should not be generating initially", () => {
			const { result } = renderHook(() => useInferenceDictation());

			expect(result.current.isGenerating).toBe(false);
		});
	});

	describe("toggleInferenceMode", () => {
		it("should toggle inference mode from false to true", () => {
			const { result } = renderHook(() => useInferenceDictation());

			expect(result.current.inferenceMode).toBe(false);

			act(() => {
				result.current.toggleInferenceMode();
			});

			expect(result.current.inferenceMode).toBe(true);
		});

		it("should toggle inference mode from true to false", () => {
			const { result } = renderHook(() => useInferenceDictation());

			act(() => {
				result.current.toggleInferenceMode();
			});

			expect(result.current.inferenceMode).toBe(true);

			act(() => {
				result.current.toggleInferenceMode();
			});

			expect(result.current.inferenceMode).toBe(false);
		});
	});

	describe("setInferenceMode", () => {
		it("should set inference mode to true", () => {
			const { result } = renderHook(() => useInferenceDictation());

			act(() => {
				result.current.setInferenceMode(true);
			});

			expect(result.current.inferenceMode).toBe(true);
		});

		it("should set inference mode to false", () => {
			const { result } = renderHook(() => useInferenceDictation());

			act(() => {
				result.current.setInferenceMode(true);
			});

			act(() => {
				result.current.setInferenceMode(false);
			});

			expect(result.current.inferenceMode).toBe(false);
		});
	});

	describe("buildPayload", () => {
		it("should build payload with generate_files flag", () => {
			const { result } = renderHook(() => useInferenceDictation());

			const payload = result.current.buildPayload(
				"Create a hello world script",
			);

			expect(payload.generate_files).toBe(true);
		});

		it("should include transcribed text as prompt", () => {
			const { result } = renderHook(() => useInferenceDictation());

			const payload = result.current.buildPayload(
				"Write a function to sort an array",
			);

			expect(payload.input.messages[0].content).toBe(
				"Write a function to sort an array",
			);
		});

		it("should include target file when provided", () => {
			const { result } = renderHook(() =>
				useInferenceDictation({
					activeFile: "/src/main.py",
				}),
			);

			const payload = result.current.buildPayload("Add error handling");

			expect(payload.target_file).toBe("/src/main.py");
		});

		it("should include file context when provided", () => {
			const { result } = renderHook(() =>
				useInferenceDictation({
					activeFile: "/src/main.py",
					fileContent: "def hello():\n    print('hello')",
				}),
			);

			const payload = result.current.buildPayload("Add error handling");

			expect(payload.file_context).toBe("def hello():\n    print('hello')");
		});

		it("should not include target_file when no active file", () => {
			const { result } = renderHook(() => useInferenceDictation());

			const payload = result.current.buildPayload("Create a new file");

			expect(payload.target_file).toBeUndefined();
		});

		it("should not include file_context when no content provided", () => {
			const { result } = renderHook(() =>
				useInferenceDictation({
					activeFile: "/src/main.py",
				}),
			);

			const payload = result.current.buildPayload("Add code");

			expect(payload.file_context).toBeUndefined();
		});
	});

	describe("setIsGenerating", () => {
		it("should update isGenerating state", () => {
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

	describe("with context options", () => {
		it("should update options dynamically", () => {
			const { result, rerender } = renderHook(
				(props) => useInferenceDictation(props),
				{
					initialProps: {
						activeFile: "/file1.txt",
						fileContent: "content1",
					},
				},
			);

			let payload = result.current.buildPayload("test");
			expect(payload.target_file).toBe("/file1.txt");
			expect(payload.file_context).toBe("content1");

			rerender({
				activeFile: "/file2.txt",
				fileContent: "content2",
			});

			payload = result.current.buildPayload("test");
			expect(payload.target_file).toBe("/file2.txt");
			expect(payload.file_context).toBe("content2");
		});
	});
});
