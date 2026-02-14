import { ImagePreview } from "./ImagePreview";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { useChatContext } from "@/context/ChatContext";
import { useEffect, useState } from "react";
import useAppHook from "@/hooks/useAppHook";
import ChatSubmitButton from "../buttons/ChatSubmitButton";
import { useVoiceVisualizer, VoiceVisualizer } from "react-voice-visualizer";
import BaseToolMenu from "../menus/BaseToolMenu";
import AgentMenu from "../menus/AgentMenu";
import { useProjectContext } from "@/context/ProjectContext";
import { X, Folder, FolderCode } from "lucide-react";
import { Button } from "../ui/button";
import QueuePanel from "../panels/QueuePanel";
import { ModelBadge } from "@/components/badges/ModelBadge";
import { useNavigate } from "react-router";

export default function ChatInput({
	showAgentMenu = false,
}: {
	showAgentMenu?: boolean;
}) {
	const [isRecording, setIsRecording] = useState(false);
	const { isLikelyMobile } = useAppHook();
	const navigate = useNavigate();
	const { selectedProject, selectProject } = useProjectContext();
	const {
		query,
		setQuery,
		abortQuery,
		images,
		setImages,
		previewImage,
		previewImageIndex,
		removeImage,
		handleImageClick,
		handleTextareaResize,
		handlePaste,
		handleDrop,
		setPreviewImage,
		handleSubmit,
		metadata,
		setMetadata,
		viewMode,
		setViewMode,
		filesMap,
		inputRef,
		enqueue,
		displayModel,
	} = useChatContext();

	// Helper to enqueue and clear input
	const handleEnqueue = (q: string, imgs: File[]) => {
		enqueue(q, imgs);
		setQuery("");
		setImages([]);
	};

	const handleResetProject = () => {
		selectProject(null);
		setMetadata((prev: any) => {
			const { project_id, ...rest } = prev;
			return rest;
		});
		localStorage.removeItem("current_project_id");
	};

	// Count total files across all messages
	const fileCount = Array.from(filesMap?.values() || []).reduce(
		(acc: number, files: any) => acc + Object.keys(files || {}).length,
		0,
	);

	const toggleViewMode = () => {
		setViewMode(viewMode === "chat" ? "editor" : "chat");
	};

	// Initialize the recorder controls using the hook
	const recorderControls = useVoiceVisualizer();

	useEffect(() => {
		if (inputRef.current) {
			inputRef.current.focus();
		}
	}, [inputRef]);

	return (
		<div className="flex flex-col w-full">
			{/* Queue Panel - shows queued messages above input */}
			<QueuePanel />

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
				ref={inputRef}
				className={`w-full resize-none overflow-y-auto min-h-[48px] max-h-[200px] p-4 pr-14 bg-background border border-input ${isRecording ? "rounded-none" : "rounded-t-3xl"} focus:outline-none border-b-0`}
				placeholder="How can I help you be more productive?"
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
						// Use enqueue instead of direct handleSubmit - queue handles timing
						if (!isLikelyMobile()) handleEnqueue(query, images);
					}
				}}
			/>
			<div className="flex justify-between items-center bg-background border border-input rounded-b-3xl border-t-0">
				<div className="flex items-center gap-1">
					<div className="flex gap-1">
						{/* <ImageUpload /> */}
						<BaseToolMenu />
						{showAgentMenu && (
							<div className="max-w-62">
								<AgentMenu />
							</div>
						)}
						{/* File toggle button */}
						<Button
							variant={viewMode === "editor" ? "secondary" : "default"}
							size="sm"
							className="rounded-xl h-9 px-2 gap-1 relative w-9 p-0 justify-center"
							onClick={toggleViewMode}
							title={viewMode === "editor" ? "Back to Chat" : "Manage Files"}
						>
							<FolderCode className="h-4 w-4" />
							{fileCount > 0 && (
								<span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
									{fileCount}
								</span>
							)}
						</Button>
					</div>

					{metadata?.project_id && selectedProject && (
						<Button
							variant="ghost"
							size="sm"
							className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
							onClick={handleResetProject}
						>
							<Folder className="h-3 w-3" />
							<span className="max-w-24 truncate">{selectedProject.name}</span>
							<X className="h-3 w-3" />
						</Button>
					)}
				</div>
				<div className="flex items-center gap-2">
					{displayModel && (
						<button
							onClick={() => navigate("/settings")}
							title="Change default model"
							className="cursor-pointer hover:opacity-80 transition-opacity"
						>
							<ModelBadge model={displayModel} />
						</button>
					)}
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
