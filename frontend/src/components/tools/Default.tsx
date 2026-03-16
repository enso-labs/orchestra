import { useMemo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
	oneDark,
	oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "@/hooks/useTheme";

interface Props {
	selectedToolMessage: any;
	collapsed?: boolean;
}

export default function DefaultTool({
	selectedToolMessage,
	collapsed = true,
}: Props) {
	const { theme } = useTheme();

	// Derive raw input value for stable dependency tracking
	const rawInput =
		selectedToolMessage?.args ??
		selectedToolMessage?.input ??
		selectedToolMessage?.content;

	const content = useMemo(() => {
		if (rawInput == null) return "";

		if (typeof rawInput === "object") {
			return JSON.stringify(rawInput, null, 2);
		}

		if (!rawInput) return "";

		// rawInput is a non-empty string — try to pretty-print as JSON
		try {
			const parsed = JSON.parse(rawInput);
			return JSON.stringify(parsed, null, 2);
		} catch {
			// Mid-stream incomplete JSON or non-JSON text — pass through as-is
			return String(rawInput);
		}
	}, [rawInput]);

	const language = useMemo(() => {
		const trimmed = content.trimStart();
		if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
			return "json";
		}
		// Also detect if content was successfully parsed as JSON (pretty-printed)
		try {
			JSON.parse(content);
			return "json";
		} catch {
			return "markdown";
		}
	}, [content]);

	const maxHeight = useMemo(() => {
		const lineCount = content.split("\n").length;
		const raw = lineCount * 18 + 10;
		if (collapsed) {
			return Math.max(60, Math.min(raw, 100));
		}
		return Math.max(60, Math.min(raw, 300));
	}, [content, collapsed]);

	if (!selectedToolMessage || !content) return null;

	return (
		<SyntaxHighlighter
			style={theme === "light" ? oneLight : oneDark}
			language={language}
			wrapLongLines={true}
			customStyle={{
				margin: 0,
				fontSize: "11px",
				maxHeight,
				overflow: "auto",
				borderRadius: "0.375rem",
			}}
		>
			{content}
		</SyntaxHighlighter>
	);
}
