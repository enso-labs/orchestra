import { useState } from "react";
import { Plus, Users, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { A2aServerConfig } from "./types";

interface A2aAgentPanelProps {
	a2aServers: Record<string, A2aServerConfig>;
	a2aAgents: any[];
	selectedTools: Set<string>;
	onToggleSelection: (toolName: string) => void;
	onAddServer: (name: string, config: A2aServerConfig) => void;
	onRemoveServer: (name: string) => void;
	onFetchAgents: (config: Record<string, A2aServerConfig>) => Promise<void>;
	isLoading: boolean;
}

export function A2aAgentPanel({
	a2aServers,
	a2aAgents,
	selectedTools,
	onToggleSelection,
	onAddServer,
	onRemoveServer,
	onFetchAgents,
	isLoading,
}: A2aAgentPanelProps) {
	const [showAddForm, setShowAddForm] = useState(false);
	const [serverName, setServerName] = useState("");
	const [baseUrl, setBaseUrl] = useState("");
	const [agentCardPath, setAgentCardPath] = useState("/.well-known/agent.json");

	const handleAddServer = () => {
		if (!serverName.trim() || !baseUrl.trim()) return;

		onAddServer(serverName.trim(), {
			base_url: baseUrl.trim(),
			agent_card_path: agentCardPath.trim() || "/.well-known/agent.json",
		});

		// Reset form
		setServerName("");
		setBaseUrl("");
		setAgentCardPath("/.well-known/agent.json");
		setShowAddForm(false);
	};

	const handleFetchAgents = async () => {
		await onFetchAgents(a2aServers);
	};

	const serverCount = Object.keys(a2aServers).length;

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex-shrink-0 border-b border-border px-4 sm:px-8 lg:px-12 py-4 sm:py-6 space-y-4">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-xl sm:text-2xl font-semibold text-foreground">
							A2A Agents
						</h2>
						<p className="text-sm text-muted-foreground">
							Configure Agent-to-Agent protocol servers
						</p>
					</div>
					<Button
						onClick={() => setShowAddForm(!showAddForm)}
						size="sm"
						variant={showAddForm ? "outline" : "default"}
					>
						<Plus className="h-4 w-4 mr-2" />
						{showAddForm ? "Cancel" : "Add Agent"}
					</Button>
				</div>

				{/* Add Server Form */}
				{showAddForm && (
					<Card className="p-4 space-y-4">
						<div className="space-y-2">
							<Label htmlFor="a2aServerName">Agent Name</Label>
							<Input
								id="a2aServerName"
								placeholder="currency_agent"
								value={serverName}
								onChange={(e) => setServerName(e.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="a2aBaseUrl">Base URL</Label>
							<Input
								id="a2aBaseUrl"
								placeholder="https://a2a.example.com"
								value={baseUrl}
								onChange={(e) => setBaseUrl(e.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="a2aCardPath">Agent Card Path</Label>
							<Input
								id="a2aCardPath"
								placeholder="/.well-known/agent.json"
								value={agentCardPath}
								onChange={(e) => setAgentCardPath(e.target.value)}
							/>
							<p className="text-xs text-muted-foreground">
								Default: /.well-known/agent.json
							</p>
						</div>

						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								onClick={() => {
									setShowAddForm(false);
									setServerName("");
									setBaseUrl("");
									setAgentCardPath("/.well-known/agent.json");
								}}
							>
								Cancel
							</Button>
							<Button
								onClick={handleAddServer}
								disabled={!serverName.trim() || !baseUrl.trim()}
							>
								Add Agent
							</Button>
						</div>
					</Card>
				)}

				{/* Server List */}
				{serverCount > 0 && (
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<p className="text-sm font-medium text-foreground">
								Configured Agents ({serverCount})
							</p>
							<Button
								size="sm"
								variant="outline"
								onClick={handleFetchAgents}
								disabled={isLoading}
							>
								{isLoading ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Loading Agents...
									</>
								) : (
									<>
										<Users className="h-4 w-4 mr-2" />
										Fetch Capabilities
									</>
								)}
							</Button>
						</div>

						<div className="space-y-2">
							{Object.entries(a2aServers).map(([name, config]) => (
								<Card key={name} className="p-3">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<Users className="h-4 w-4 text-muted-foreground" />
											<div>
												<p className="text-sm font-medium text-foreground">
													{name}
												</p>
												<p className="text-xs text-muted-foreground">
													{config.base_url}
												</p>
											</div>
										</div>
										<Button
											size="icon"
											variant="ghost"
											onClick={() => onRemoveServer(name)}
										>
											<Trash2 className="h-4 w-4 text-destructive" />
										</Button>
									</div>
								</Card>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Agent Cards Display */}
			<div className="flex-1 overflow-hidden">
				{a2aAgents.length > 0 ? (
					<div className="p-4 sm:p-8 lg:p-12 space-y-4">
						{a2aAgents.map((agent) => (
							<Card
								key={agent.name}
								className={`p-4 cursor-pointer transition-all duration-150 hover:shadow-sm hover:border-primary/30 ${
									selectedTools.has(
										agent.name.toLowerCase().replace(/\s+/g, "_"),
									)
										? "border-primary border-2 bg-primary/5"
										: "border-border bg-card"
								}`}
								onClick={() =>
									onToggleSelection(
										agent.name.toLowerCase().replace(/\s+/g, "_"),
									)
								}
							>
								<div className="flex items-start gap-4">
									<div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
										<Users className="h-6 w-6 text-primary" />
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-start justify-between gap-2">
											<div>
												<h3 className="text-base font-semibold text-foreground">
													{agent.name}
												</h3>
												<p className="text-sm text-muted-foreground mt-1">
													{agent.description}
												</p>
											</div>
											{selectedTools.has(
												agent.name.toLowerCase().replace(/\s+/g, "_"),
											) && (
												<div className="flex-shrink-0 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
													<svg
														className="w-3 h-3 text-primary-foreground"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={3}
															d="M5 13l4 4L19 7"
														/>
													</svg>
												</div>
											)}
										</div>

										{agent.skills && agent.skills.length > 0 && (
											<div className="mt-3">
												<p className="text-xs font-medium text-muted-foreground mb-2">
													Skills:
												</p>
												<div className="flex flex-wrap gap-2">
													{agent.skills.map((skill: any, idx: number) => (
														<span
															key={idx}
															className="px-2 py-1 bg-secondary rounded-md text-xs text-secondary-foreground"
														>
															{skill.name || skill.id}
														</span>
													))}
												</div>
											</div>
										)}

										{agent.url && (
											<p className="text-xs text-muted-foreground mt-2">
												URL: {agent.url}
											</p>
										)}
									</div>
								</div>
							</Card>
						))}
					</div>
				) : (
					<div className="flex items-center justify-center h-full">
						<div className="text-center space-y-2">
							<Users className="h-12 w-12 text-muted-foreground mx-auto" />
							<p className="text-muted-foreground">
								{serverCount === 0
									? "Add an A2A agent to get started"
									: "Click 'Fetch Capabilities' to load agent information"}
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
