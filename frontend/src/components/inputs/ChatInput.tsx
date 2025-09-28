import { ImagePreview } from "./ImagePreview";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { useChatContext } from "@/context/ChatContext";
import { useRef, useEffect, useState } from "react";
import useAppHook from "@/hooks/useAppHook";
import ChatSubmitButton from "../buttons/ChatSubmitButton";
import { useVoiceVisualizer, VoiceVisualizer } from "react-voice-visualizer";
import { useAppContext } from "@/context/AppContext";
import BaseToolMenu from "../menus/BaseToolMenu";
import AgentMenu from "../menus/AgentMenu";

export default function ChatInput({
	showAgentMenu = false,
}: {
	showAgentMenu?: boolean;
}) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [isRecording, setIsRecording] = useState(false);
	const { loading } = useAppContext();
	const {
		query,
		abortQuery,
		images,
		previewImage,
		previewImageIndex,
		removeImage,
		handleImageClick,
		handleTextareaResize,
		handlePaste,
		handleDrop,
		setPreviewImage,
		handleSubmit,
	} = useChatContext();

	const { isMobile } = useAppHook();

	// Initialize the recorder controls using the hook
	const recorderControls = useVoiceVisualizer();

	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.focus();
		}
	}, []);

	return (
		<div className="flex flex-col w-full">
			{images.length > 0 && (
				<div className="px-4 py-2">
					<ImagePreview
						images={images}
						onRemove={removeImage}
						onImageClick={(image) => handleImageClick(image, previewImageIndex)}
					/>
				</div>
			)}

			{/* Voice Visualizer - only show when recording */}
			{isRecording && (
				<div className="px-4 py-2 bg-background border border-input rounded-t-3xl border-b-0">
					<VoiceVisualizer
						controls={recorderControls}
						height={35}
						width="100%"
						isControlPanelShown={false}
						isDefaultUIShown={false}
						onlyRecording={true}
						speed={1}
						barWidth={2}
					/>
				</div>
			)}

			<textarea
				ref={textareaRef}
				className={`w-full resize-none overflow-y-auto min-h-[48px] max-h-[200px] p-4 pr-14 bg-background border border-input ${isRecording ? "rounded-none" : "rounded-t-3xl"} focus:outline-none border-b-0`}
				placeholder="How can I help you be present?"
				rows={1}
				value={query}
				onChange={handleTextareaResize}
				onPaste={handlePaste}
				onDrop={handleDrop}
				onDragOver={(e) => e.preventDefault()}
				onKeyDown={(e) => {
					if (
						e.key === "Enter" &&
						!e.shiftKey &&
						!isRecording &&
						query.length > 0
					) {
						e.preventDefault();
						if (!loading && !isMobile()) handleSubmit(query, images);
					}
				}}
			/>
			<div className="flex justify-between items-center bg-background border border-input rounded-b-3xl border-t-0">
				<div className="flex items-center gap-1">
					<div className="flex gap-1">
						{/* <ImageUpload /> */}
						<BaseToolMenu />
					</div>
					{showAgentMenu && (
						<div className="w-48">
							<AgentMenu />
						</div>
					)}
				</div>
				<div className="flex items-center gap-2">
					<ChatSubmitButton
						abortQuery={abortQuery}
						handleSubmit={handleSubmit}
						onRecordingChange={setIsRecording}
						recorderControls={recorderControls}
					/>
				</div>
			</div>
			<ImagePreviewModal
				image={previewImage}
				onClose={() => setPreviewImage(null)}
				index={previewImageIndex}
			/>
		</div>
	);
}
