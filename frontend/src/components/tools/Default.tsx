import { useMemo } from "react";
import Editor from "@monaco-editor/react";
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

	const content = useMemo(() => {
		if (!selectedToolMessage) return "";

		const input =
			selectedToolMessage.args ||
			selectedToolMessage.input ||
			selectedToolMessage.content;

		if (input == null) return "";

		if (typeof input === "object") {
			return JSON.stringify(input, null, 2);
		}

		// input is a string — try to pretty-print as JSON
		try {
			const parsed = JSON.parse(input);
			return JSON.stringify(parsed, null, 2);
		} catch {
			// Mid-stream incomplete JSON or non-JSON text — pass through as-is
			return String(input);
		}
	}, [selectedToolMessage]);

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

	const height = useMemo(() => {
		const lineCount = content.split("\n").length;
		const raw = lineCount * 18 + 10;
		if (collapsed) {
			return Math.max(60, Math.min(raw, 100));
		}
		return Math.max(60, Math.min(raw, 300));
	}, [content, collapsed]);

	if (!selectedToolMessage) return null;

	return (
		<div style={{ height }}>
			<Editor
				value={content}
				language={language}
				height={height}
				theme={theme === "light" ? "light" : "vs-dark"}
				options={{
					readOnly: true,
					domReadOnly: true,
					minimap: { enabled: false },
					lineNumbers: "off",
					wordWrap: "on",
					fontSize: 11,
					scrollBeyondLastLine: false,
					renderLineHighlight: "none",
					contextmenu: false,
					folding: !collapsed,
					scrollbar: {
						vertical: "hidden",
						horizontal: "hidden",
						handleMouseWheel: true,
					},
				}}
			/>
		</div>
	);
}
