import JsonView from "@uiw/react-json-view"
import { githubDarkTheme } from "@uiw/react-json-view/githubDark"

interface Props {
	selectedToolMessage: any
}

export default function DefaultTool({ selectedToolMessage }: Props) {
	if (!selectedToolMessage) return null;
	return (
		<div className="space-y-4">
			<div className="prose prose-sm dark:prose-invert">
				<div className="space-y-2">
					<div className="max-h-[600px] mt-2 p-2 bg-muted rounded-lg overflow-x-auto">
						{(() => {
							try {
								const input =
									selectedToolMessage.args || selectedToolMessage.input;
								const parsedJSON =
									typeof input === "object" ? input : JSON.parse(input);
								return (
									<JsonView
										value={parsedJSON}
										onCopied={async (text) => {
											await navigator.clipboard.writeText(text);
											alert("Copied to clipboard (Tool Input)");
										}}
										style={{ ...githubDarkTheme, fontSize: "10px" }}
									/>
								);
							} catch (error) {
								return (
									<div className="text-red-500">
										<p className="font-bold">Error parsing JSON:</p>
										<p>{(error as Error).message}</p>
										<p className="mt-2 font-bold">Raw content:</p>
										<pre className="whitespace-pre-wrap text-xs mt-1 p-2 bg-slate-800 rounded overflow-x-auto">
											{JSON.stringify(
												selectedToolMessage.args || selectedToolMessage.input
											)}
										</pre>
									</div>
								);
							}
						})()}
					</div>
				</div>
			</div>
		</div>
	);
}