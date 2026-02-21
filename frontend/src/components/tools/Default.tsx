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

	// Resolve JSON data for JsonView, or fallback content for other cases
	let jsonValue: object | null = null;
	let fallback: JSX.Element | null = null;

	if (typeof input === "object" && input !== null) {
		// Already a parsed object
		jsonValue = input;
	} else if (typeof input === "string" && input) {
		try {
			const parsed = JSON.parse(input);

			if (parsed === null || parsed === undefined) {
				fallback = (
					<span className="text-xs text-muted-foreground p-2">null</span>
				);
			} else if (typeof parsed !== "object") {
				fallback = <span className="text-xs p-2">{String(parsed)}</span>;
			} else {
				jsonValue = parsed;
			}
		} catch {
			// JSON is incomplete (still streaming) — display as syntax-highlighted text
			fallback = (
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
			);
		}
	} else {
		// Fallback for null/undefined/empty input
		fallback = <span className="text-xs text-muted-foreground p-2">null</span>;
	}

	return (
		<div className="max-h-[100px] rounded overflow-x-auto">
			{jsonValue ? (
				<JsonView
					collapsed={collapsed}
					value={jsonValue}
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
			) : (
				fallback
			)}
		</div>
	);
}
