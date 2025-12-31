import { useState, useEffect, useCallback, RefObject } from "react";

interface TextSelection {
	selectedText: string | null;
	selectionRect: DOMRect | null;
	clearSelection: () => void;
}

export default function useTextSelection(
	containerRef: RefObject<HTMLElement>,
): TextSelection {
	const [selectedText, setSelectedText] = useState<string | null>(null);
	const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);

	const clearSelection = useCallback(() => {
		setSelectedText(null);
		setSelectionRect(null);
		window.getSelection()?.removeAllRanges();
	}, []);

	useEffect(() => {
		const handleSelectionChange = () => {
			const selection = window.getSelection();

			if (!selection || selection.isCollapsed || !selection.rangeCount) {
				setSelectedText(null);
				setSelectionRect(null);
				return;
			}

			const range = selection.getRangeAt(0);
			const container = containerRef.current;

			// Check if selection is within our container
			if (!container || !container.contains(range.commonAncestorContainer)) {
				setSelectedText(null);
				setSelectionRect(null);
				return;
			}

			const text = selection.toString().trim();
			if (!text) {
				setSelectedText(null);
				setSelectionRect(null);
				return;
			}

			setSelectedText(text);
			setSelectionRect(range.getBoundingClientRect());
		};

		// Use mouseup for more reliable selection detection
		const handleMouseUp = () => {
			// Small delay to ensure selection is finalized
			setTimeout(handleSelectionChange, 10);
		};

		document.addEventListener("selectionchange", handleSelectionChange);
		document.addEventListener("mouseup", handleMouseUp);

		return () => {
			document.removeEventListener("selectionchange", handleSelectionChange);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [containerRef]);

	return { selectedText, selectionRect, clearSelection };
}
