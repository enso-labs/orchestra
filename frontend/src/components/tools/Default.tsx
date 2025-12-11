import JsonView from "@uiw/react-json-view";
import { githubDarkTheme } from "@uiw/react-json-view/githubDark";
import { githubLightTheme } from "@uiw/react-json-view/githubLight";
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
	return (
		<div className="max-h-[100px] rounded overflow-x-auto">
			{(() => {
				try {
					let parsedJSON =
						typeof input === "object" ? input : JSON.parse(input);

					if (parsedJSON === null || parsedJSON === undefined) {
						return (
							<span className="text-xs text-muted-foreground p-2">null</span>
						);
					}

					// If the parsed result is not an object (e.g. string, number, boolean), display it directly
					if (typeof parsedJSON !== "object") {
						return <span className="text-xs p-2">{String(parsedJSON)}</span>;
					}

					return (
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
					);
				} catch (error) {
					return (
						<div className="text-red-500">
							<p className="font-bold">Error parsing JSON:</p>
							<p>{(error as Error).message}</p>
							<p className="mt-2 font-bold">Raw content:</p>
							<pre className="whitespace-pre-wrap text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">
								{JSON.stringify(input)}
							</pre>
						</div>
					);
				}
			})()}
		</div>
	);
}
