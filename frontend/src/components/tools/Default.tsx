import MarkdownCard from "@/components/cards/MarkdownCard"
import { Wrench } from "lucide-react"
import { cn } from "@/lib/utils"

export default function DefaultTool({ selectedToolMessage }: { selectedToolMessage: any }) {
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
						<div className="max-w-[290px] max-h-[600px] mt-2 p-2 bg-muted rounded-lg overflow-x-auto">
							<MarkdownCard content={selectedToolMessage.content} />
						</div>
					</div>
					<div>
						<span className="font-semibold">Output:</span>
						<div className="max-w-[290px] max-h-[600px] mt-2 p-2 bg-muted rounded-lg overflow-x-auto">
							<MarkdownCard content={selectedToolMessage.output} />
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}