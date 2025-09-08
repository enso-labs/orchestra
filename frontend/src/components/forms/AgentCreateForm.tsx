import { Button } from "@/components/ui/button";
import { ChevronLeft, X, Maximize2, Wand2 } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// TODO: This is only for the desktop version.
function AgentCreateForm({
	navigate,
	processCreateAgent,
	isCreating,
	agentDetails,
	setAgentDetails,
	payload,
	setPayload,
	showPromptGenerator,
	setShowPromptGenerator,
	setIsFullscreen,
	promptDescription,
	setPromptDescription,
	conversationStarters,
	setConversationStarters,
	handleAddConversationStarter,
	handleRemoveConversationStarter,
	handleGeneratePrompt,
	isGenerating,
}: {
	navigate: (path: string) => void;
	processCreateAgent: () => void;
	isCreating: boolean;
	agentDetails: {
		name: string;
		description: string;
		model?: string;
		system?: string;
	};
	setAgentDetails: (details: {
		name: string;
		description: string;
		model?: string;
		system?: string;
	}) => void;
	payload: { model: string; system: string };
	setPayload: (payload: { model: string; system: string }) => void;
	showPromptGenerator: boolean;
	setShowPromptGenerator: (show: boolean) => void;
	setIsFullscreen: (isFullscreen: boolean) => void;
	promptDescription: string;
	setPromptDescription: (promptDescription: string) => void;
	conversationStarters: string[];
	setConversationStarters: (conversationStarters: string[]) => void;
	handleAddConversationStarter: () => void;
	handleRemoveConversationStarter: (index: number) => void;
	handleGeneratePrompt: (mode: "replace" | "alter") => void;
	isGenerating: boolean;
}) {
	return (
		<div className="p-4 h-full overflow-y-auto">
			<div className="flex items-center mb-6">
				<Button
					variant="ghost"
					size="icon"
					className="mr-2"
					onClick={() => navigate("/")}
				>
					<ChevronLeft className="h-5 w-5" />
				</Button>
				<div>
					<h1 className="text-lg font-medium">New Enso</h1>
					<p className="text-xs text-muted-foreground">• Draft</p>
				</div>
				<div className="ml-auto">
					<Button
						className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
						onClick={processCreateAgent}
						disabled={isCreating}
					>
						{isCreating ? "Creating..." : "Create"}
					</Button>
				</div>
			</div>

			{/* Desktop Tabs - Only visible on desktop */}
			<div className="hidden md:block">
				<Tabs defaultValue="create" className="w-full">
					{/* <TabsList className="grid w-full grid-cols-2 mb-8 bg-secondary rounded-md">
						<TabsTrigger value="create">Create</TabsTrigger>
						<TabsTrigger value="configure">Configure</TabsTrigger>
					</TabsList> */}

					<TabsContent value="create" className="space-y-6">
						{/* <div className="flex justify-center mb-8">
							<div className="w-24 h-24 rounded-full border-2 border-dashed border-border flex items-center justify-center">
								<Button variant="ghost" size="icon" className="rounded-full">
									<span className="text-2xl">+</span>
								</Button>
							</div>
						</div> */}

						<div className="space-y-4 max-w-full">
							<div>
								<label className="block mb-2 text-sm font-medium">Name</label>
								<Input
									placeholder="Name your Enso"
									className="bg-secondary/50 border-border"
									value={agentDetails.name}
									onChange={(e) =>
										setAgentDetails({ ...agentDetails, name: e.target.value })
									}
								/>
							</div>

							<div>
								<label className="block mb-2 text-sm font-medium">
									Description
								</label>
								<Textarea
									placeholder="Add a short description about what this Enso does"
									className="bg-secondary/50 border-border resize-none"
									rows={2}
									value={agentDetails.description}
									onChange={(e) =>
										setAgentDetails({
											...agentDetails,
											description: e.target.value,
										})
									}
								/>
							</div>

							<div>
								<label className="block mb-2 text-sm font-medium">Model</label>
								<Input
									placeholder="Name your Enso"
									className="bg-secondary/50 border-border"
									disabled
									value={payload.model}
								/>
							</div>

							<div>
								<label className="block mb-2 text-sm font-medium">
									System Message
								</label>
								<div className="relative">
									<Textarea
										placeholder="What does this Enso do? How does it behave? What should it avoid doing?"
										className="bg-secondary/50 border-border resize-none"
										rows={10}
										value={payload.system}
										onChange={(e) => {
											setPayload({ ...payload, system: e.target.value });
										}}
									/>
									<div className="flex justify-end mt-1 gap-1">
										<Button
											variant="ghost"
											size="icon"
											className="h-5 w-5"
											onClick={() =>
												setShowPromptGenerator(!showPromptGenerator)
											}
											title="Generate system prompt"
										>
											<Wand2 className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="h-5 w-5"
											onClick={() => setIsFullscreen(true)}
										>
											<Maximize2 className="h-4 w-4" />
										</Button>
									</div>
								</div>

								{showPromptGenerator && (
									<div className="mt-2 bg-background border rounded-md shadow-md p-3">
										<div className="flex flex-col gap-2">
											<div className="text-xs font-medium">
												Describe what you want the AI to do
											</div>
											<input
												type="text"
												className="w-full p-2 border rounded text-sm"
												placeholder="e.g., Act as a JavaScript expert"
												value={promptDescription}
												onChange={(e) => setPromptDescription(e.target.value)}
											/>
											<div className="flex justify-end gap-2">
												<Button
													variant="outline"
													size="sm"
													onClick={() => setShowPromptGenerator(false)}
												>
													Cancel
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleGeneratePrompt("alter")}
													disabled={isGenerating || !promptDescription.trim()}
												>
													{isGenerating ? "Processing..." : "Alter"}
												</Button>
												<Button
													size="sm"
													onClick={() => handleGeneratePrompt("replace")}
													disabled={isGenerating || !promptDescription.trim()}
												>
													{isGenerating ? "Processing..." : "Replace"}
												</Button>
											</div>
										</div>
									</div>
								)}
							</div>

							<div>
								<label className="block mb-2 text-sm font-medium">
									Conversation starters
								</label>
								{conversationStarters.map((starter, index) => (
									<div key={index} className="flex mb-2 w-full">
										<Input
											value={starter}
											onChange={(e) => {
												const newStarters = [...conversationStarters];
												newStarters[index] = e.target.value;
												setConversationStarters(newStarters);
											}}
											className="bg-secondary/50 border-border flex-1"
										/>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => handleRemoveConversationStarter(index)}
											className="ml-1 flex-shrink-0"
										>
											<X className="h-4 w-4" />
										</Button>
									</div>
								))}
								{conversationStarters.length < 4 && (
									<Button
										variant="outline"
										onClick={handleAddConversationStarter}
										className="w-full mt-2 border-dashed border-border bg-transparent"
									>
										Add starter
									</Button>
								)}
							</div>

							<div>
								<label className="block mb-2 text-sm font-medium">
									Knowledge
								</label>
								<p className="text-sm text-muted-foreground">
									If you upload files under Knowledge, conversations with your
									Enso may include file contents. Files can be downloaded when
									Code Interpreter is enabled
								</p>
							</div>
						</div>
					</TabsContent>

					<TabsContent value="configure">
						<div className="flex items-center justify-center h-64 text-muted-foreground">
							Configuration options would appear here
						</div>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}

export default AgentCreateForm;
