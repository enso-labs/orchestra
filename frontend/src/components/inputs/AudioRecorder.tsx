import { Square } from "lucide-react";
import { Mic } from "lucide-react";
import React, { useEffect } from "react";
import apiClient from "../../lib/utils/apiClient";
import { useChatContext } from "../../context/ChatContext";
import { MainToolTip } from "../tooltips/MainToolTip";

interface AudioRecorderProps {
	onRecordingChange?: (isRecording: boolean) => void;
	recorderControls?: any; // VoiceVisualizer controls
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
	onRecordingChange,
	recorderControls,
}) => {
	const { setQuery } = useChatContext();

	const {
		startRecording,
		stopRecording,
		isRecordingInProgress,
		recordedBlob,
		error,
	} = recorderControls || {};

	// Notify parent component when recording state changes
	useEffect(() => {
		onRecordingChange?.(isRecordingInProgress);
	}, [isRecordingInProgress, onRecordingChange]);

	// Add keyboard event handler
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// Check for Alt+H combination
			if (event.altKey && event.key.toLowerCase() === "h") {
				event.preventDefault(); // Prevent default browser behavior

				if (isRecordingInProgress) {
					handleStopRecording();
				} else {
					handleStartRecording();
				}
			}
		};

		// Add event listener
		document.addEventListener("keydown", handleKeyDown);

		// Cleanup event listener on unmount
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isRecordingInProgress]); // Include recording state in dependency array

	// Handle recorded blob when it's available
	useEffect(() => {
		if (!recordedBlob) return;

		// Create FormData and send to transcription endpoint
		const formData = new FormData();
		formData.append("file", recordedBlob, "recording.webm");
		formData.append("model", "whisper-large-v3");
		formData.append("response_format", "verbose_json");
		formData.append("temperature", "0.0");
		formData.append("timeout", "30");

		apiClient
			.post("/llm/transcribe", formData, {
				headers: {
					"Content-Type": "multipart/form-data",
				},
			})
			.then((response) => {
				setQuery((prev: string) =>
					prev
						? `${prev} ${response.data.transcript.text}`
						: response.data.transcript.text,
				);
			})
			.catch((error) => {
				console.error("Error uploading audio:", error);
				alert("Error uploading audio");
			});
	}, [recordedBlob, setQuery]);

	const handleStartRecording = async () => {
		if (startRecording) {
			startRecording();
		}
	};

	const handleStopRecording = () => {
		if (stopRecording) {
			stopRecording();
		}
	};

	return (
		<div>
			{error && (
				<div className="text-red-500 text-sm mb-2">{error.message}</div>
			)}
			{!isRecordingInProgress ? (
				<MainToolTip content="Start recording (Alt + H)">
					<button onClick={handleStartRecording} className="flex items-center">
						<Mic className="mr-1 h-6 w-6" />
					</button>
				</MainToolTip>
			) : (
				<MainToolTip content="Stop recording (Alt + H)">
					<button onClick={handleStopRecording} className="flex items-center">
						<Square className="mr-1 h-6 w-6" />
					</button>
				</MainToolTip>
			)}
		</div>
	);
};
