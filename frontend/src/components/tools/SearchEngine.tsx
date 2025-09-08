import MarkdownCard from "../cards/MarkdownCard";

export default function SearchEngineTool({ selectedToolMessage }: { selectedToolMessage: any }) {
	return (
		<div className="max-h-[600px] mt-2 p-2rounded-lg overflow-y-auto">
			<div className="space-y-4">
				{selectedToolMessage.content &&
				typeof selectedToolMessage.content === "string" ? (
					(() => {
						try {
							const parsedOutput = JSON.parse(selectedToolMessage.content);
							return parsedOutput.map((result: any, index: number) => (
								<div
									key={index}
									className="border-b border-border pb-4 last:border-0 last:pb-0"
								>
									<a
										href={result.link}
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary hover:underline font-medium"
									>
										{result.title}
									</a>
									<p className="text-sm text-muted-foreground mt-1">
										{result.snippet}
									</p>
									<div className="flex gap-2 mt-2">
										{result.engines.map(
											(engine: string, engineIndex: number) => (
												<span
													key={engineIndex}
													className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
												>
													{engine}
												</span>
											)
										)}
									</div>
								</div>
							));
						} catch (e) {
							return (
								<MarkdownCard
									content={
										selectedToolMessage.content || selectedToolMessage.output
									}
								/>
							);
						}
					})()
				) : (
					<p>No output data available</p>
				)}
			</div>
		</div>
	);
}