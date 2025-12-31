import { RefObject, useEffect, useState } from "react";
import { Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import useTextSelection from "@/hooks/useTextSelection";

interface TextSelectionPopoverProps {
	containerRef: RefObject<HTMLElement>;
	onAddToInput: (text: string) => void;
}

export default function TextSelectionPopover({
	containerRef,
	onAddToInput,
}: TextSelectionPopoverProps) {
	const { selectedText, selectionRect, clearSelection } =
		useTextSelection(containerRef);
	const [position, setPosition] = useState<{
		top: number;
		left: number;
	} | null>(null);

	useEffect(() => {
		if (!selectionRect || !containerRef.current) {
			setPosition(null);
			return;
		}

		const containerRect = containerRef.current.getBoundingClientRect();

		// Position above the selection, centered horizontally
		const top = selectionRect.top - containerRect.top - 40;
		const left =
			selectionRect.left - containerRect.left + selectionRect.width / 2 - 40; // 40 = half button width approx

		setPosition({ top, left });
	}, [selectionRect, containerRef]);

	if (!selectedText || !position) {
		return null;
	}

	const handleClick = () => {
		onAddToInput(selectedText);
		clearSelection();
	};

	return (
		<div
			className="absolute z-50 animate-in fade-in-0 zoom-in-95 duration-100"
			style={{
				top: `${position.top}px`,
				left: `${position.left}px`,
			}}
		>
			<Button
				size="sm"
				variant="secondary"
				className="h-8 gap-1.5 shadow-lg border bg-popover text-popover-foreground hover:bg-accent"
				onClick={handleClick}
			>
				<Quote className="h-3.5 w-3.5" />
				<span className="text-xs">Quote</span>
			</Button>
		</div>
	);
}
