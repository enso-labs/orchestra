import { useState, useCallback, useMemo } from "react";

/**
 * Options for the useInferenceDictation hook.
 */
export interface UseInferenceDictationOptions {
	/** The currently active file path */
	activeFile?: string;
	/** The content of the currently active file */
	fileContent?: string;
}

/**
 * Payload structure for inference dictation requests.
 */
export interface InferenceDictationPayload {
	input: {
		messages: Array<{
			role: "user";
			content: string;
		}>;
	};
	generate_files: boolean;
	target_file?: string;
	file_context?: string;
}

/**
 * Return type for the useInferenceDictation hook.
 */
export interface UseInferenceDictationReturn {
	/** Whether inference mode is currently active */
	inferenceMode: boolean;
	/** Toggle inference mode on/off */
	toggleInferenceMode: () => void;
	/** Set inference mode directly */
	setInferenceMode: (value: boolean) => void;
	/** Build the payload for an LLM inference request */
	buildPayload: (transcript: string) => InferenceDictationPayload;
	/** Whether content is currently being generated */
	isGenerating: boolean;
	/** Set the generating state */
	setIsGenerating: (value: boolean) => void;
}

/**
 * Hook for managing inference dictation mode in the file editor.
 *
 * When inference mode is active, dictated text is sent to an LLM
 * to generate file content, rather than being inserted directly.
 *
 * @param options - Configuration options for the hook
 * @returns Hook state and methods for inference dictation
 *
 * @example
 * ```tsx
 * const { inferenceMode, toggleInferenceMode, buildPayload } = useInferenceDictation({
 *   activeFile: '/src/main.py',
 *   fileContent: 'def hello(): pass',
 * });
 *
 * // When dictation completes:
 * if (inferenceMode) {
 *   const payload = buildPayload(transcribedText);
 *   // Send payload to LLM stream endpoint
 * }
 * ```
 */
export default function useInferenceDictation(
	options?: UseInferenceDictationOptions,
): UseInferenceDictationReturn {
	const [inferenceMode, setInferenceMode] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);

	const toggleInferenceMode = useCallback(() => {
		setInferenceMode((prev) => !prev);
	}, []);

	const buildPayload = useCallback(
		(transcript: string): InferenceDictationPayload => {
			const payload: InferenceDictationPayload = {
				input: {
					messages: [
						{
							role: "user",
							content: transcript,
						},
					],
				},
				generate_files: true,
			};

			// Include target file if active file is provided
			if (options?.activeFile) {
				payload.target_file = options.activeFile;
			}

			// Include file context if file content is provided
			if (options?.fileContent) {
				payload.file_context = options.fileContent;
			}

			return payload;
		},
		[options?.activeFile, options?.fileContent],
	);

	return useMemo(
		() => ({
			inferenceMode,
			toggleInferenceMode,
			setInferenceMode,
			buildPayload,
			isGenerating,
			setIsGenerating,
		}),
		[inferenceMode, toggleInferenceMode, buildPayload, isGenerating],
	);
}
