import Editor from "@monaco-editor/react";
import YAML from "yaml";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { debounce } from "lodash";

interface OpenAPISpec {
	paths?: Record<
		string,
		Record<
			string,
			{
				operationId?: string;
				summary?: string;
				description?: string;
				tags?: string[];
				[key: string]: unknown;
			}
		>
	>;
	[key: string]: unknown;
}

interface ActionFileEditorProps {
	actionId: string;
	spec: OpenAPISpec | null;
	onSpecChange: (spec: OpenAPISpec | string) => void;
}

function ActionFileEditor({
	actionId,
	spec,
	onSpecChange,
}: ActionFileEditorProps) {
	// Extract tools from swagger paths
	const getToolsFromPaths = () => {
		if (!spec || !spec.paths) return [];

		const tools: {
			path: string;
			method: string;
			operationId: string;
			summary: string;
			description: string;
			tags: string[];
		}[] = [];
		Object.entries(spec.paths).forEach(([path, operations]) => {
			Object.entries(operations).forEach(([method, operation]) => {
				tools.push({
					path,
					method: method.toUpperCase(),
					operationId:
						operation.operationId ||
						`${method}_${path.replace(/[^a-zA-Z0-9]/g, "_")}`,
					summary: operation.summary || "",
					description: operation.description || "",
					tags: operation.tags || [],
				});
			});
		});
		return tools;
	};

	const tools = getToolsFromPaths();

	return (
		<>
			<label className="block mb-2 text-sm font-medium">
				OpenAPI Specification
			</label>
			<Editor
				key={actionId} // Force re-render when action changes
				value={spec ? YAML.stringify(spec, null, 2) : ""}
				height="25vh"
				onChange={debounce((value: string | undefined) => {
					if (value) {
						try {
							const parsed = YAML.parse(value);
							onSpecChange(parsed);
						} catch {
							// Handle YAML parsing errors if needed
							onSpecChange(value);
						}
					}
				}, 300)}
				defaultLanguage="yaml"
				theme="vs-dark"
				options={{
					tabSize: 2,
					insertSpaces: true,
					fontSize: 12,
				}}
			/>

			{/* Tools Table */}
			<div className="mt-4 border rounded-lg bg-card">
				<div className="p-3 border-b bg-muted/50">
					<h3 className="text-sm font-medium">
						Generated Tools ({tools.length})
					</h3>
				</div>
				<ScrollArea className="h-[150px]">
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="sticky top-0 bg-muted/30 border-b">
								<tr>
									<th className="text-left p-2 font-medium">Method</th>
									<th className="text-left p-2 font-medium">Path</th>
									<th className="text-left p-2 font-medium">Operation ID</th>
									<th className="text-left p-2 font-medium">Summary</th>
									<th className="text-left p-2 font-medium">Tags</th>
								</tr>
							</thead>
							<tbody>
								{tools.map((tool, index) => (
									<tr key={index} className="border-b hover:bg-muted/20">
										<td className="p-2">
											<Badge
												variant={
													tool.method === "GET"
														? "secondary"
														: tool.method === "POST"
															? "default"
															: tool.method === "PUT"
																? "outline"
																: tool.method === "DELETE"
																	? "destructive"
																	: "secondary"
												}
												className="text-xs"
											>
												{tool.method}
											</Badge>
										</td>
										<td className="p-2 font-mono text-xs">{tool.path}</td>
										<td className="p-2 text-xs">{tool.operationId}</td>
										<td className="p-2 text-xs">
											{tool.summary || tool.description}
										</td>
										<td className="p-2">
											<div className="flex gap-1 flex-wrap">
												{tool.tags.map((tag: string, tagIndex: number) => (
													<Badge
														key={tagIndex}
														variant="outline"
														className="text-xs"
													>
														{tag}
													</Badge>
												))}
											</div>
										</td>
									</tr>
								))}
								{tools.length === 0 && (
									<tr>
										<td
											colSpan={5}
											className="p-4 text-center text-muted-foreground"
										>
											No tools found. Add paths to your API specification.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</ScrollArea>
			</div>
		</>
	);
}

export default ActionFileEditor;
