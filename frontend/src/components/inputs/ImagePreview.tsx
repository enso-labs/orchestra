import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImagePreviewProps {
	images: File[];
	onRemove: (index: number) => void;
	onImageClick: (image: File) => void;
}

export function ImagePreview({
	images,
	onRemove,
	onImageClick,
}: ImagePreviewProps) {
	if (!images.length) return null;

	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
			{images.map((image, index) => (
				<div key={`${image.name}-${index}`} className="relative">
					<div className="flex items-center gap-2 p-2 bg-background/50 border border-input rounded-lg">
						<div
							className="flex items-center gap-2 text-sm text-muted-foreground w-full cursor-pointer"
							onClick={() => onImageClick(image)}
						>
							<div className="w-8 h-8 bg-muted rounded flex items-center justify-center shrink-0">
								<img
									src={URL.createObjectURL(image) || "/placeholder.svg"}
									alt="Preview"
									className="w-6 h-6 object-cover"
								/>
							</div>
							<div className="min-w-0 flex-1">
								<div className="truncate">image_{index + 1}</div>
								<div className="text-xs">
									{(image.size / 1024).toFixed(2)}kB
								</div>
							</div>
						</div>
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6 shrink-0"
							onClick={(e) => {
								e.stopPropagation();
								onRemove(index);
							}}
						>
							<X className="h-4 w-4" />
							<span className="sr-only">Remove image</span>
						</Button>
					</div>
				</div>
			))}
		</div>
	);
}
