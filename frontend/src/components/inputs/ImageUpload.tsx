import { useChatContext } from "@/context/ChatContext";
import { MainToolTip } from "../tooltips/MainToolTip";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";
import { useRef } from "react";
import useAppHook from "@/hooks/useAppHook";

interface ImageUploadProps {
	triggerCameraInput?: (e: React.MouseEvent) => void;
	triggerFileInput?: (e: React.MouseEvent) => void;
	fileInputRef?: React.RefObject<HTMLInputElement>;
	cameraInputRef?: React.RefObject<HTMLInputElement>;
	addImages: (files: File[]) => void;
}

function ImageUploadMobile({
	triggerCameraInput,
	cameraInputRef,
	addImages,
}: ImageUploadProps) {
	return (
		<MainToolTip content="Take Photo">
			<>
				<Button
					size="icon"
					variant="outline"
					className="rounded-full ml-1 bg-foreground/10 text-foreground-500 cursor-pointer"
					onClick={triggerCameraInput}
				>
					<Plus className="h-4 w-4" />
				</Button>
				<input
					type="file"
					className="hidden"
					ref={cameraInputRef}
					accept="image/*"
					onChange={(e) => {
						const files = Array.from(e.target.files || []);
						addImages(files);
						e.target.value = ""; // Reset input
					}}
				/>
			</>
		</MainToolTip>
	);
}

function ImageUploadDesktop({
	triggerFileInput,
	fileInputRef,
	addImages,
}: ImageUploadProps) {
	return (
		<MainToolTip content="Upload Files">
			<Button
				size="icon"
				variant="outline"
				className="rounded-full ml-1 bg-foreground/10 text-foreground-500 cursor-pointer"
				onClick={triggerFileInput}
			>
				<input
					type="file"
					className="hidden"
					ref={fileInputRef}
					multiple
					accept="image/*"
					onChange={(e) => {
						const files = Array.from(e.target.files || []);
						addImages(files);
						e.target.value = ""; // Reset input
					}}
				/>
				<Plus className="h-4 w-4" />
			</Button>
		</MainToolTip>
	);
}

function ImageUpload() {
	const { isMobile } = useAppHook();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const cameraInputRef = useRef<HTMLInputElement>(null);

	const { addImages } = useChatContext();

	const triggerCameraInput = (e: React.MouseEvent) => {
		e.preventDefault();
		if (cameraInputRef.current) {
			cameraInputRef.current.click();
		}
	};

	const triggerFileInput = (e: React.MouseEvent) => {
		e.preventDefault();
		fileInputRef.current?.click();
	};

	if (isMobile()) {
		return (
			<ImageUploadMobile
				triggerCameraInput={triggerCameraInput}
				cameraInputRef={cameraInputRef}
				addImages={addImages}
			/>
		);
	}

	return (
		<ImageUploadDesktop
			triggerFileInput={triggerFileInput}
			fileInputRef={fileInputRef}
			addImages={addImages}
		/>
	);
}

export default ImageUpload;
