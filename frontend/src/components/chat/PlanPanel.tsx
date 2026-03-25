import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, FileText, Check, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface PlanPanelProps {
	plan: string;
	status: "planning" | "awaiting_approval" | "approved" | "generating";
	onApprove?: () => void;
	onReject?: () => void;
}

const statusColors = {
	planning: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
	awaiting_approval: "bg-blue-500/10 text-blue-600 border-blue-500/30",
	approved: "bg-green-500/10 text-green-600 border-green-500/30",
	generating: "bg-purple-500/10 text-purple-600 border-purple-500/30",
};

const statusLabels = {
	planning: "Planning...",
	awaiting_approval: "Awaiting Approval",
	approved: "Approved",
	generating: "Generating...",
};

export function PlanPanel({
	plan,
	status,
	onApprove,
	onReject,
}: PlanPanelProps) {
	const [isOpen, setIsOpen] = useState(status === "awaiting_approval");

	useEffect(() => {
		if (status === "awaiting_approval") {
			setIsOpen(true);
		}
	}, [status]);

	return (
		<div className="my-2 rounded-lg border border-border bg-card">
			<Collapsible open={isOpen} onOpenChange={setIsOpen}>
				<CollapsibleTrigger asChild>
					<button className="flex w-full items-center gap-2 px-4 py-3 text-sm hover:bg-accent/50 transition-colors rounded-t-lg">
						{isOpen ? (
							<ChevronDown className="h-4 w-4 text-muted-foreground" />
						) : (
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
						)}
						<FileText className="h-4 w-4 text-muted-foreground" />
						<span className="font-medium">Product Plan</span>
						<Badge
							variant="outline"
							className={`ml-auto text-xs ${statusColors[status]}`}
						>
							{statusLabels[status]}
						</Badge>
					</button>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<div className="border-t border-border px-4 py-3">
						<ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
							{plan}
						</ReactMarkdown>
						{status === "awaiting_approval" && (
							<div className="mt-4 flex gap-2 border-t border-border pt-3">
								<Button
									size="sm"
									variant="default"
									onClick={() => onApprove?.()}
									className="gap-1.5"
								>
									<Check className="h-3.5 w-3.5" />
									Approve Plan
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={() => onReject?.()}
									className="gap-1.5"
								>
									<X className="h-3.5 w-3.5" />
									Reject
								</Button>
							</div>
						)}
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}
