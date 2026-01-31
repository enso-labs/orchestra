import { useState, useEffect } from "react";
import { Server, Check, Search } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { McpServerConfig } from "@/lib/entities";
import useServer from "@/hooks/useServer";

interface ServerSelectionModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (servers: McpServerConfig[]) => void;
	excludeIds?: string[];
}

export function ServerSelectionModal({
	isOpen,
	onClose,
	onSelect,
	excludeIds = [],
}: ServerSelectionModalProps) {
	const { servers, loading, handleGetServers } = useServer();
	const [search, setSearch] = useState("");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	useEffect(() => {
		if (isOpen) {
			handleGetServers();
			setSelectedIds(new Set());
			setSearch("");
		}
	}, [isOpen]);

	const availableServers = servers.filter(
		(s) =>
			!excludeIds.includes(s.id) &&
			s.name.toLowerCase().includes(search.toLowerCase()),
	);

	const toggleServer = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const handleApply = () => {
		const selected = servers.filter((s) => selectedIds.has(s.id));
		onSelect(selected);
		onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Server className="h-5 w-5" />
						Import from Saved Servers
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search servers..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-9"
						/>
					</div>

					<div className="max-h-[400px] overflow-y-auto space-y-2">
						{loading ? (
							<p className="text-sm text-muted-foreground text-center py-8">
								Loading servers...
							</p>
						) : availableServers.length === 0 ? (
							<p className="text-sm text-muted-foreground text-center py-8">
								{servers.length === 0
									? "No saved servers. Create one from the MCP Servers page."
									: "No matching servers found."}
							</p>
						) : (
							availableServers.map((server) => {
								const isSelected = selectedIds.has(server.id);
								return (
									<Card
										key={server.id}
										className={`p-3 cursor-pointer transition-all ${
											isSelected
												? "border-primary bg-primary/10"
												: "hover:bg-muted/50"
										}`}
										onClick={() => toggleServer(server.id)}
									>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<Server className="h-4 w-4 text-muted-foreground" />
												<div>
													<p className="text-sm font-medium">{server.name}</p>
													<p className="text-xs text-muted-foreground">
														{server.url}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-2">
												<Badge variant="outline" className="text-xs">
													{server.transport === "sse"
														? "SSE"
														: "Streamable HTTP"}
												</Badge>
												{isSelected && (
													<div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
														<Check className="h-3 w-3 text-primary-foreground" />
													</div>
												)}
											</div>
										</div>
									</Card>
								);
							})
						)}
					</div>

					<div className="flex items-center justify-between pt-2 border-t">
						<p className="text-sm text-muted-foreground">
							{selectedIds.size > 0
								? `${selectedIds.size} server${selectedIds.size !== 1 ? "s" : ""} selected`
								: "Select servers to import"}
						</p>
						<div className="flex gap-2">
							<Button variant="outline" onClick={onClose}>
								Cancel
							</Button>
							<Button onClick={handleApply} disabled={selectedIds.size === 0}>
								Import Selected
							</Button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
