import React from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { McpServerConfig } from "@/lib/entities";
import {
	Server,
	MoreHorizontal,
	Pencil,
	Trash2,
	Globe,
	Calendar,
} from "lucide-react";

interface ServerCardProps {
	server: McpServerConfig;
	onEdit?: (id: string) => void;
	onDelete?: (id: string) => void;
}

export const ServerCard: React.FC<ServerCardProps> = ({
	server,
	onEdit,
	onDelete,
}) => {
	return (
		<Card className="hover:shadow-md transition-shadow duration-200">
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-2">
						<Server className="h-4 w-4 text-primary" />
						<Badge variant="outline" className="text-xs">
							{server.transport === "sse" ? "SSE" : "Streamable HTTP"}
						</Badge>
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{onEdit && (
								<DropdownMenuItem onClick={() => onEdit(server.id)}>
									<Pencil className="mr-2 h-4 w-4" />
									Edit
								</DropdownMenuItem>
							)}
							{onDelete && (
								<DropdownMenuItem
									onClick={() => onDelete(server.id)}
									className="text-destructive focus:text-destructive"
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				<CardTitle className="text-base line-clamp-1">{server.name}</CardTitle>
				<CardDescription className="text-sm">
					<div className="flex items-center gap-1 line-clamp-1">
						<Globe className="h-3 w-3 flex-shrink-0" />
						<span className="truncate">{server.url}</span>
					</div>
				</CardDescription>
			</CardHeader>
			<CardContent className="pt-0">
				<div className="text-xs text-muted-foreground border-t pt-2">
					<div className="flex items-center gap-1">
						<Calendar className="h-3 w-3" />
						<span>
							{server.created_at
								? new Date(server.created_at).toLocaleDateString()
								: "—"}
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};
