import { Button } from "@/components/ui/button"
import { X, Wand2 } from "lucide-react"
import Editor from '@monaco-editor/react';
import { useToolContext } from "@/context/ToolContext"
import YAML from 'yaml';
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

function FileEditor() {
	const { swagger, setSwaggerSpec } = useToolContext();

	// Extract tools from swagger paths
	const getToolsFromPaths = () => {
		if (!swagger || !swagger.paths) return [];
		
		const tools: any[] = [];
		Object.entries(swagger.paths).forEach(([path, operations]: [string, any]) => {
			Object.entries(operations).forEach(([method, operation]: [string, any]) => {
				tools.push({
					path,
					method: method.toUpperCase(),
					operationId: operation.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
					summary: operation.summary || '',
					description: operation.description || '',
					tags: operation.tags || []
				});
			});
		});
		return tools;
	};

	const tools = getToolsFromPaths();

	return (
		<div className="fixed inset-0 z-50 bg-background p-4 flex flex-col">
			<div className="flex justify-between items-center mb-4">
				<h2 className="text-lg font-medium">API Specification Editor</h2>
				<div className="flex items-center gap-2">
					<Button 
						variant="ghost" 
						size="icon" 
						// onClick={() => setShowPromptGenerator(!showPromptGenerator)}
						title="Generate system prompt"
					>
						<Wand2 className="h-5 w-5" />
					</Button>
					<Button 
						variant="ghost" 
						size="icon" 
						// onClick={() => setIsFullscreen(false)}
					>
						<X className="h-5 w-5" />
					</Button>
				</div>
			</div>

			<Editor 
				value={swagger ? YAML.stringify(swagger, null, 2) : ''}
				onChange={(value) => {
					if (value) {
						try {
							const parsed = YAML.parse(value);
							setSwaggerSpec(parsed);
						} catch (error) {
							// Handle YAML parsing errors if needed
							setSwaggerSpec(value);
						}
					}
				}}
				defaultLanguage="yaml"
				theme="vs-dark"
				options={{
					tabSize: 2,
					insertSpaces: true,
					fontSize: 12
				}}
			/>

			{/* Tools Table */}
			<div className="mt-4 border rounded-lg bg-card">
				<div className="p-3 border-b bg-muted/50">
					<h3 className="text-sm font-medium">Generated Tools ({tools.length})</h3>
				</div>
				<ScrollArea className="h-[200px]">
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
												variant={tool.method === 'GET' ? 'secondary' : 
														tool.method === 'POST' ? 'default' : 
														tool.method === 'PUT' ? 'outline' : 
														tool.method === 'DELETE' ? 'destructive' : 'secondary'}
												className="text-xs"
											>
												{tool.method}
											</Badge>
										</td>
										<td className="p-2 font-mono text-xs">{tool.path}</td>
										<td className="p-2 text-xs">{tool.operationId}</td>
										<td className="p-2 text-xs">{tool.summary || tool.description}</td>
										<td className="p-2">
											<div className="flex gap-1 flex-wrap">
												{tool.tags.map((tag: string, tagIndex: number) => (
													<Badge key={tagIndex} variant="outline" className="text-xs">
														{tag}
													</Badge>
												))}
											</div>
										</td>
									</tr>
								))}
								{tools.length === 0 && (
									<tr>
										<td colSpan={5} className="p-4 text-center text-muted-foreground">
											No tools found. Add paths to your API specification.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</ScrollArea>
			</div>
		</div>
	)
}

export default FileEditor;