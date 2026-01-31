import { ColorModeButton } from "@/components/buttons/ColorModeButton";
import { MainToolTip } from "@/components/tooltips/MainToolTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import HouseIcon from "@/components/icons/HouseIcon";
import { Plus, Search, Server } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { McpServerConfig } from "@/lib/entities";
import { ServerCard } from "@/components/cards/ServerCard";
import { ServerForm } from "@/components/forms/servers/ServerForm";
import useServer from "@/hooks/useServer";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

function ServersIndexPage() {
	const navigate = useNavigate();
	const { servers, loading, handleDeleteServer, useEffectGetServers } =
		useServer();
	const [searchQuery, setSearchQuery] = useState("");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editServer, setEditServer] = useState<McpServerConfig | null>(null);

	useEffectGetServers();

	const filteredServers = useMemo(() => {
		if (!searchQuery.trim()) return servers;
		const query = searchQuery.toLowerCase();
		return servers.filter(
			(server: McpServerConfig) =>
				server.name.toLowerCase().includes(query) ||
				server.url.toLowerCase().includes(query),
		);
	}, [servers, searchQuery]);

	const onDelete = async (id: string) => {
		if (window.confirm("Are you sure you want to delete this server?")) {
			await handleDeleteServer(id);
		}
	};

	const onEdit = (id: string) => {
		const server = servers.find((s: McpServerConfig) => s.id === id);
		if (server) setEditServer(server);
	};

	const onFormSuccess = () => {
		setIsCreateOpen(false);
		setEditServer(null);
	};

	return (
		<div className="h-screen flex flex-col">
			{/* Header with navigation and actions */}
			<div className="absolute top-4 right-4 z-10">
				<div className="flex flex-row gap-2 items-center">
					<MainToolTip content="New Server" delayDuration={500}>
						<Button
							variant="outline"
							size="icon"
							onClick={() => setIsCreateOpen(true)}
						>
							<Plus className="h-4 w-4" />
						</Button>
					</MainToolTip>
					<ColorModeButton />
				</div>
			</div>
			<div className="absolute top-4 left-4 z-10">
				<div className="flex flex-row gap-2 items-center">
					<Button variant="outline" size="icon" onClick={() => navigate("/")}>
						<HouseIcon />
					</Button>
				</div>
			</div>

			{/* Main content */}
			<div className="flex-1 flex flex-col min-h-0 pt-16">
				{/* Fixed header section */}
				<div className="flex-shrink-0 px-4">
					<div className="mx-auto">
						<div className="mb-5">
							<h1 className="text-3xl font-bold text-foreground mb-2">
								MCP Servers
							</h1>
							<p className="text-muted-foreground mb-6">
								Manage your MCP server configurations
							</p>

							{/* Search bar */}
							<div className="relative max-w-md mb-4">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									type="text"
									placeholder="Search servers by name or URL..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-10"
								/>
							</div>
						</div>

						{/* Results summary */}
						<div className="mb-6">
							<p className="text-sm text-muted-foreground">
								{filteredServers.length === servers.length
									? `Showing all ${filteredServers.length} servers`
									: `Found ${filteredServers.length} servers`}
								{searchQuery && ` matching "${searchQuery}"`}
							</p>
						</div>
					</div>
				</div>

				{/* Scrollable content area */}
				<div className="flex-1 min-h-0 px-4">
					<div className="mx-auto h-full">
						<ScrollArea className="h-full">
							<div className="pb-4">
								{loading ? (
									<div className="text-center py-12">
										<Server className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
										<h3 className="text-lg font-semibold text-foreground mb-2">
											Loading servers...
										</h3>
									</div>
								) : filteredServers.length > 0 ? (
									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 mb-8">
										{filteredServers.map((server: McpServerConfig) => (
											<ServerCard
												key={server.id}
												server={server}
												onEdit={onEdit}
												onDelete={onDelete}
											/>
										))}
									</div>
								) : (
									<div className="text-center py-12">
										<Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
										<h3 className="text-lg font-semibold text-foreground mb-2">
											No servers found
										</h3>
										<p className="text-muted-foreground mb-4">
											{searchQuery
												? `No servers match your search for "${searchQuery}"`
												: "You haven't configured any MCP servers yet"}
										</p>
										<div className="flex gap-2 justify-center">
											{searchQuery && (
												<Button
													variant="outline"
													onClick={() => setSearchQuery("")}
												>
													Clear search
												</Button>
											)}
											<Button onClick={() => setIsCreateOpen(true)}>
												<Plus className="h-4 w-4 mr-2" />
												Add Server
											</Button>
										</div>
									</div>
								)}
							</div>
						</ScrollArea>
					</div>
				</div>
			</div>

			{/* Create Server Dialog */}
			<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>Add MCP Server</DialogTitle>
					</DialogHeader>
					<ServerForm
						onSuccess={onFormSuccess}
						onCancel={() => setIsCreateOpen(false)}
					/>
				</DialogContent>
			</Dialog>

			{/* Edit Server Dialog */}
			<Dialog open={!!editServer} onOpenChange={() => setEditServer(null)}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>Edit MCP Server</DialogTitle>
					</DialogHeader>
					<ServerForm
						server={editServer}
						onSuccess={onFormSuccess}
						onCancel={() => setEditServer(null)}
					/>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default ServersIndexPage;
