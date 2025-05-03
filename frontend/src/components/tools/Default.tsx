// import MarkdownCard from "@/components/cards/MarkdownCard"
import { Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import JsonView from "@uiw/react-json-view"
import { githubDarkTheme } from "@uiw/react-json-view/githubDark"
import MarkdownCard from "../cards/MarkdownCard"

interface Props {
	selectedToolMessage: any
}

export default function DefaultTool({ selectedToolMessage }: Props) {
	if (!selectedToolMessage) return null;
	return (
		<div className="space-y-4">
			<div className="flex items-center space-x-2">
				<div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
					<Wrench className="h-4 w-4 text-primary" />
				</div>
				<div>
					<h3 className="font-medium">{selectedToolMessage.name}</h3>
					<p className="text-sm text-muted-foreground">Tool Execution Details</p>
				</div>
			</div>

			<div className="prose prose-sm dark:prose-invert">
				<div className="space-y-2">
					<div className="flex items-center gap-2">
						<span className="font-semibold">Status:</span>
						<span
							className={cn(
								"text-xs px-2 py-0.5 rounded-full",
								selectedToolMessage.status === "success"
									? "bg-green-500/20 text-green-500"
									: "bg-red-500/20 text-red-500",
							)}
						>
							{selectedToolMessage.status}
						</span>
					</div>
					<div>
						<span className="font-semibold">Input:</span>
						<div className="max-h-[600px] mt-2 p-2 bg-muted rounded-lg overflow-x-auto">
							{(() => {
								try {
									const input = selectedToolMessage.args || selectedToolMessage.input;
									const parsedJSON = typeof input === 'object' ? input : JSON.parse(input);
									return <JsonView value={parsedJSON} style={githubDarkTheme} />;
								} catch (error) {
									return (
										<div className="text-red-500">
											<p className="font-bold">Error parsing JSON:</p>
											<p>{(error as Error).message}</p>
											<p className="mt-2 font-bold">Raw content:</p>
											<pre className="whitespace-pre-wrap text-xs mt-1 p-2 bg-slate-800 rounded overflow-x-auto">
												{JSON.stringify(selectedToolMessage.args)}
											</pre>
										</div>
									);
								}
							})()}
						</div>
					</div>
					<div>
						<span className="font-semibold">Output:</span>
						<div className="max-h-[600px] mt-2 p-2 bg-muted rounded-lg overflow-x-auto">
							{(() => {
								try {
									const parsedJSON = JSON.parse(selectedToolMessage.content || selectedToolMessage.output);
									return <JsonView value={parsedJSON} style={githubDarkTheme} />;
								} catch (error) {
									return <MarkdownCard content={selectedToolMessage.content || selectedToolMessage.output} />
								}
							})()}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}