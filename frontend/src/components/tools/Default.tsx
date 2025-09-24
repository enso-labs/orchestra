import JsonView from "@uiw/react-json-view";
import { githubDarkTheme } from "@uiw/react-json-view/githubDark";

interface Props {
	selectedToolMessage: any;
	collapsed?: boolean;
}

export default function DefaultTool({
	selectedToolMessage,
	collapsed = true,
}: Props) {
	if (!selectedToolMessage) return null;

	const input =
		selectedToolMessage.args ||
		selectedToolMessage.input ||
		selectedToolMessage.content;
	return (
		<div className="max-h-[600px] rounded overflow-x-auto">
			{(() => {
				try {
					const parsedJSON =
						typeof input === "object" ? input : JSON.parse(input);
					return (
						<JsonView
							collapsed={collapsed}
							value={parsedJSON}
							onCopied={async (text) => {
								await navigator.clipboard.writeText(text);
								alert("Copied to clipboard (Tool Input)");
							}}
							style={{ ...githubDarkTheme, fontSize: "10px", padding: "5px" }}
						/>
					);
				} catch (error) {
					return (
						<div className="text-red-500">
							<p className="font-bold">Error parsing JSON:</p>
							<p>{(error as Error).message}</p>
							<p className="mt-2 font-bold">Raw content:</p>
							<pre className="whitespace-pre-wrap text-xs mt-1 p-2 bg-slate-800 rounded overflow-x-auto">
								{JSON.stringify(input)}
							</pre>
						</div>
					);
				}
			})()}
		</div>
	);
}
