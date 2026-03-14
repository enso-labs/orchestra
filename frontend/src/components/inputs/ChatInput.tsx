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
import { X, Folder, Check } from "lucide-react";
import { Button } from "../ui/button";
import QueuePanel from "../panels/QueuePanel";
import { ModelBadge } from "@/components/badges/ModelBadge";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { useModelVisibility } from "@/hooks/useModelVisibility";
import { patchDefaults } from "@/lib/services/userSettingsService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ChatInput({
	showAgentMenu = false,
}: {
	showAgentMenu?: boolean;
}) {
	const [isRecording, setIsRecording] = useState(false);
	const [modelOpen, setModelOpen] = useState(false);
	const { isLikelyMobile } = useAppHook();
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
		inputRef,
		enqueue,
		displayModel,
		models,
		setModel,
	} = useChatContext();

	const { isModelVisible } = useModelVisibility();
	const visibleModels = (models?.models || []).filter((m: string) =>
		isModelVisible(m),
	);

	const handleModelSelect = async (model: string) => {
		setModelOpen(false);
		try {
			await patchDefaults({ model });
			setModel(model);
			toast.success("Default model updated");
		} catch {
			toast.error("Failed to update model");
		}
	};

	// Helper to enqueue and clear input
	const handleEnqueue = (q: string, imgs: File[]) => {
		enqueue(q, imgs);
		setQuery("");
		setImages([]);
	};

	const handleResetProject = () => {
		selectProject(null);
		setMetadata((prev: any) => {
			const { project_id: _project_id, ...rest } = prev;
			return rest;
		});
		localStorage.removeItem("current_project_id");
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
			<div className="flex justify-between items-center bg-background border border-input rounded-b-3xl border-t-0 overflow-hidden">
				<div className="flex items-center gap-1 min-w-0 flex-1">
					<div className="flex gap-1">
						{/* <ImageUpload /> */}
						<BaseToolMenu />
						{showAgentMenu && <AgentMenu />}
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
						<Popover open={modelOpen} onOpenChange={setModelOpen}>
							<PopoverTrigger asChild>
								<button
									data-tour="model-selector"
									title="Change default model"
									className="cursor-pointer hover:opacity-80 transition-opacity"
								>
									<ModelBadge model={displayModel} />
								</button>
							</PopoverTrigger>
							<PopoverContent side="top" align="end" className="w-[280px] p-0">
								<Command>
									<CommandInput placeholder="Search models..." />
									<CommandList>
										<CommandEmpty>No model found.</CommandEmpty>
										<CommandGroup>
											{visibleModels.map((modelValue: string) => (
												<CommandItem
													key={modelValue}
													value={modelValue}
													onSelect={handleModelSelect}
												>
													<Check
														className={cn(
															"mr-2 h-4 w-4",
															displayModel === modelValue
																? "opacity-100"
																: "opacity-0",
														)}
													/>
													{modelValue.split(":")[1] || modelValue}
												</CommandItem>
											))}
										</CommandGroup>
									</CommandList>
								</Command>
							</PopoverContent>
						</Popover>
					)}
					<div data-tour="chat-submit-button">
						<ChatSubmitButton
							abortQuery={abortQuery}
							handleSubmit={handleSubmit}
							onRecordingChange={setIsRecording}
							recorderControls={recorderControls}
						/>
					</div>
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
