import { Wand2, Maximize2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft } from "lucide-react";
import useAgentHook from "./hooks/useAgentHook";
import { useNavigate } from "react-router-dom";
import { useAgentContext } from "@/context/AgentContext";
import { useChatContext } from "@/context/ChatContext";
import SelectModel from "@/components/selects/SelectModel";
import FileEditor from "@/components/FileEditor";
import { useAppContext } from "@/context/AppContext";
import { ChatNav } from "@/components/nav/ChatNav";
import ChatMessages from "@/components/lists/ChatMessages";
import ChatInput from "@/components/inputs/ChatInput";

function AgentCreateMobile() {
	const navigate = useNavigate();
	const { isMenuOpen, setIsMenuOpen } = useAppContext();
	const { payload, setPayload, messages, messagesEndRef } = useChatContext();
	const { agentDetails, setAgentDetails, isCreating } = useAgentContext();
	const {
		activeTab,
		setActiveTab,
		showPromptGenerator,
		setShowPromptGenerator,
		isGenerating,
		handleGeneratePrompt,
		processCreateAgent,
		setIsFullscreen,
		promptDescription,
		setPromptDescription,
	} = useAgentHook();

	return (
		<div className="flex flex-col md:hidden h-screen w-full bg-background text-foreground overflow-hidden">
			{/* Mobile Tabs - Only visible on mobile */}
			<div className="w-full p-4 pb-0">
				<Tabs value={activeTab} className="w-full">
					<TabsList className="grid w-full grid-cols-2 bg-secondary rounded-md">
						<TabsTrigger
							value="settings"
							onClick={() => setActiveTab("settings")}
						>
							Settings
						</TabsTrigger>
						<TabsTrigger
							value="preview"
							onClick={() => setActiveTab("preview")}
						>
							Preview
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			{/* Left panel - Settings (Mobile) */}
			<div className={`${
				activeTab === "settings" ? "block" : "hidden"
			} flex-1 p-4 border-b border-border overflow-y-auto`}>
				<div className="flex items-center mb-6">
					<Button variant="ghost" size="icon" className="mr-2" onClick={() => navigate("/")}>
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

				{/* Mobile content (no tabs, just the form) */}
				<div className="space-y-6">

					<div>
						<label className="block mb-2 text-sm font-medium">Name</label>
						<Input placeholder="Name your Enso" className="bg-secondary/50 border-border" value={agentDetails.name} onChange={(e) => setAgentDetails({ ...agentDetails, name: e.target.value })} />
					</div>

					<div>
						<label className="block mb-2 text-sm font-medium">Description</label>
						<Textarea
							placeholder="Add a short description about what this Enso does"
							className="bg-secondary/50 border-border resize-none"
							rows={2}
							value={agentDetails.description}
							onChange={(e) => setAgentDetails({ ...agentDetails, description: e.target.value })}
						/>
					</div>

					<div>
						<label className="block mb-2 text-sm font-medium">Model</label>
						<SelectModel />
					</div>

					<div>
						<label className="block mb-2 text-sm font-medium">System Message</label>
						<div className="relative">
							<Textarea
								placeholder="What does this Enso do? How does it behave? What should it avoid doing?"
								className="bg-secondary/50 border-border resize-none"
								rows={10}
								value={payload.system}
								onChange={(e) => {
									setPayload({ ...payload, system: e.target.value })
								}}
							/>
							<div className="flex justify-end mt-1 gap-1">
								<Button 
									variant="ghost" 
									size="icon" 
									className="h-5 w-5"
									onClick={() => setShowPromptGenerator(!showPromptGenerator)}
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
									<div className="text-xs font-medium">Describe what you want the AI to do</div>
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
											onClick={() => handleGeneratePrompt('alter')}
											disabled={isGenerating || !promptDescription.trim()}
										>
											{isGenerating ? "Processing..." : "Alter"}
										</Button>
										<Button 
											size="sm" 
											onClick={() => handleGeneratePrompt('replace')}
											disabled={isGenerating || !promptDescription.trim()}
										>
											{isGenerating ? "Processing..." : "Replace"}
										</Button>
									</div>
								</div>
							</div>
						)}
					</div>

					<FileEditor />
				</div>
			</div>

			{/* Right panel - Preview (Mobile) */}
			<div className={`${
				activeTab === "preview" ? "block" : "hidden"
			} flex-1 flex flex-col h-[50vh]`}>
				<ChatNav
					onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
				/>

				<div className="flex-1 overflow-y-auto p-3 min-h-0">
					<div className="space-y-4 max-w-4xl mx-auto pb-4">
						<ChatMessages messages={messages} />
						<div ref={messagesEndRef} />
					</div>
				</div>
				
				<div className="sticky bottom-0 bg-background border-border">
					<div className="max-w-4xl mx-auto">
						<div className="flex flex-col gap-2 p-4 pb-25">
							<ChatInput />
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default AgentCreateMobile;