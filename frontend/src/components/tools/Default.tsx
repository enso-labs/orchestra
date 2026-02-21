import JsonView from "@uiw/react-json-view";
import { githubDarkTheme } from "@uiw/react-json-view/githubDark";
import { githubLightTheme } from "@uiw/react-json-view/githubLight";
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

	if (!selectedToolMessage) return null;

	const input =
		selectedToolMessage.args ||
		selectedToolMessage.input ||
		selectedToolMessage.content;

	// Select JSON viewer theme based on current theme
	const getJsonTheme = () => {
		if (theme === "light") {
			return githubLightTheme;
		}
		// Use dark theme for both "dark" and "gray" themes, and system default
		return githubDarkTheme;
	};

	const getSyntaxTheme = () => {
		if (theme === "light") {
			return oneLight;
		}
		return oneDark;
	};

	// If input is already a parsed object, render with JsonView directly
	if (typeof input === "object" && input !== null && input !== undefined) {
		return (
			<div className="max-h-[100px] rounded overflow-x-auto">
				<JsonView
					collapsed={collapsed}
					value={input}
					onCopied={async (text) => {
						await navigator.clipboard.writeText(text);
						alert("Copied to clipboard (Tool Input)");
					}}
					shortenTextAfterLength={200}
					style={{
						...getJsonTheme(),
						fontSize: "10px",
						padding: "5px",
						whiteSpace: "pre-wrap",
						wordBreak: "break-word",
					}}
				/>
			</div>
		);
	}

	// For string input, try to parse as JSON
	if (typeof input === "string" && input) {
		try {
			const parsedJSON = JSON.parse(input);

			if (parsedJSON === null || parsedJSON === undefined) {
				return (
					<div className="max-h-[100px] rounded overflow-x-auto">
						<span className="text-xs text-muted-foreground p-2">null</span>
					</div>
				);
			}

			if (typeof parsedJSON !== "object") {
				return (
					<div className="max-h-[100px] rounded overflow-x-auto">
						<span className="text-xs p-2">{String(parsedJSON)}</span>
					</div>
				);
			}

			return (
				<div className="max-h-[100px] rounded overflow-x-auto">
					<JsonView
						collapsed={collapsed}
						value={parsedJSON}
						onCopied={async (text) => {
							await navigator.clipboard.writeText(text);
							alert("Copied to clipboard (Tool Input)");
						}}
						shortenTextAfterLength={200}
						style={{
							...getJsonTheme(),
							fontSize: "10px",
							padding: "5px",
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
						}}
					/>
				</div>
			);
		} catch {
			// JSON is incomplete (still streaming) — display as syntax-highlighted text
			return (
				<div className="max-h-[100px] rounded overflow-x-auto">
					<SyntaxHighlighter
						language="json"
						style={getSyntaxTheme()}
						wrapLongLines={true}
						customStyle={{
							margin: 0,
							padding: "5px",
							fontSize: "10px",
							background: "transparent",
						}}
					>
						{input}
					</SyntaxHighlighter>
				</div>
			);
		}
	}

	// Fallback for null/undefined/empty input
	return (
		<div className="max-h-[100px] rounded overflow-x-auto">
			<span className="text-xs text-muted-foreground p-2">null</span>
		</div>
	);
}
