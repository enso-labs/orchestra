import { useState, useEffect, useCallback } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	AlertTriangle,
	Check,
	X,
	Edit3,
	MessageSquare,
	Clock,
	Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
	Interrupt,
	DecisionType,
	getInterruptTimeRemaining,
	formatToolArgs,
} from "@/lib/entities/interrupt";
import {
	createApproveRequest,
	createEditRequest,
	createRejectRequest,
	createRespondRequest,
} from "@/hooks/useInterrupt";

interface InterruptApprovalDialogProps {
	interrupt: Interrupt | null;
	isOpen: boolean;
	isLoading: boolean;
	onDecision: (
		request: ReturnType<
			| typeof createApproveRequest
			| typeof createEditRequest
			| typeof createRejectRequest
			| typeof createRespondRequest
		>,
	) => Promise<void>;
	onClose: () => void;
}

/**
 * Dialog for reviewing and making decisions on Human-In-The-Loop interrupts
 *
 * Displays tool call details and allows users to:
 * - Approve: Execute the tool call as-is
 * - Edit: Modify arguments before execution
 * - Reject: Cancel the tool call with optional feedback
 * - Respond: Provide custom feedback to the LLM
 */
export function InterruptApprovalDialog({
	interrupt,
	isOpen,
	isLoading,
	onDecision,
	onClose,
}: InterruptApprovalDialogProps) {
	const [activeTab, setActiveTab] = useState<DecisionType>("approve");
	const [editedArgs, setEditedArgs] = useState("");
	const [feedback, setFeedback] = useState("");
	const [timeRemaining, setTimeRemaining] = useState(0);
	const [parseError, setParseError] = useState<string | null>(null);

	// Initialize edited args when interrupt changes
	useEffect(() => {
		if (interrupt) {
			setEditedArgs(formatToolArgs(interrupt.tool_args));
			setFeedback("");
			setParseError(null);
			setActiveTab("approve");
		}
	}, [interrupt]);

	// Update countdown timer
	useEffect(() => {
		if (!interrupt || !isOpen) return;

		const updateTimer = () => {
			const remaining = getInterruptTimeRemaining(interrupt);
			setTimeRemaining(remaining);

			// Auto-close if expired
			if (remaining <= 0) {
				onClose();
			}
		};

		updateTimer();
		const interval = setInterval(updateTimer, 1000);
		return () => clearInterval(interval);
	}, [interrupt, isOpen, onClose]);

	// Format time remaining for display
	const formatTimeRemaining = useCallback((ms: number) => {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	}, []);

	// Validate JSON when editing args
	const validateEditedArgs = useCallback((json: string): boolean => {
		try {
			JSON.parse(json);
			setParseError(null);
			return true;
		} catch (e) {
			setParseError("Invalid JSON format");
			return false;
		}
	}, []);

	// Handle decision submission
	const handleSubmit = useCallback(async () => {
		if (!interrupt) return;

		let request;
		switch (activeTab) {
			case "approve":
				request = createApproveRequest(interrupt.id);
				break;
			case "edit":
				if (!validateEditedArgs(editedArgs)) return;
				request = createEditRequest(interrupt.id, JSON.parse(editedArgs));
				break;
			case "reject":
				request = createRejectRequest(interrupt.id, feedback || undefined);
				break;
			case "respond":
				if (!feedback.trim()) {
					setParseError("Feedback is required");
					return;
				}
				request = createRespondRequest(interrupt.id, feedback);
				break;
			default:
				return;
		}

		await onDecision(request);
	}, [
		interrupt,
		activeTab,
		editedArgs,
		feedback,
		validateEditedArgs,
		onDecision,
	]);

	if (!interrupt) return null;

	const isExpiringSoon = timeRemaining < 60000; // Less than 1 minute

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<AlertTriangle className="h-5 w-5 text-amber-500" />
						Tool Approval Required
					</DialogTitle>
					<DialogDescription className="flex items-center justify-between">
						<span>
							The agent wants to execute a tool that requires your approval.
						</span>
						<Badge
							variant={isExpiringSoon ? "destructive" : "secondary"}
							className="flex items-center gap-1"
						>
							<Clock className="h-3 w-3" />
							{formatTimeRemaining(timeRemaining)}
						</Badge>
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-auto space-y-4">
					{/* Tool Information */}
					<div className="rounded-lg border bg-muted/50 p-4 space-y-3">
						<div className="flex items-center gap-2">
							<Wrench className="h-4 w-4 text-muted-foreground" />
							<span className="font-medium">{interrupt.tool_name}</span>
						</div>
						{interrupt.tool_description && (
							<p className="text-sm text-muted-foreground">
								{interrupt.tool_description}
							</p>
						)}
						<div className="text-sm text-muted-foreground">
							<span className="font-medium">Reason:</span> {interrupt.reason}
						</div>
					</div>

					{/* Decision Tabs */}
					<Tabs
						value={activeTab}
						onValueChange={(v) => setActiveTab(v as DecisionType)}
					>
						<TabsList className="grid w-full grid-cols-4">
							<TabsTrigger value="approve" className="flex items-center gap-1">
								<Check className="h-3 w-3" />
								Approve
							</TabsTrigger>
							<TabsTrigger value="edit" className="flex items-center gap-1">
								<Edit3 className="h-3 w-3" />
								Edit
							</TabsTrigger>
							<TabsTrigger value="reject" className="flex items-center gap-1">
								<X className="h-3 w-3" />
								Reject
							</TabsTrigger>
							<TabsTrigger value="respond" className="flex items-center gap-1">
								<MessageSquare className="h-3 w-3" />
								Respond
							</TabsTrigger>
						</TabsList>

						<TabsContent value="approve" className="space-y-3">
							<p className="text-sm text-muted-foreground">
								Execute this tool call with the original arguments:
							</p>
							<pre className="rounded-lg border bg-muted p-3 text-sm overflow-auto max-h-48">
								<code>{formatToolArgs(interrupt.tool_args)}</code>
							</pre>
						</TabsContent>

						<TabsContent value="edit" className="space-y-3">
							<div className="space-y-2">
								<Label htmlFor="edited-args">Edit Arguments (JSON)</Label>
								<Textarea
									id="edited-args"
									value={editedArgs}
									onChange={(e) => {
										setEditedArgs(e.target.value);
										validateEditedArgs(e.target.value);
									}}
									className={cn(
										"font-mono text-sm min-h-[150px]",
										parseError && "border-red-500",
									)}
									placeholder="Enter valid JSON"
								/>
								{parseError && (
									<p className="text-sm text-red-500">{parseError}</p>
								)}
							</div>
						</TabsContent>

						<TabsContent value="reject" className="space-y-3">
							<p className="text-sm text-muted-foreground">
								Cancel this tool call. Optionally provide feedback:
							</p>
							<div className="space-y-2">
								<Label htmlFor="reject-feedback">Feedback (optional)</Label>
								<Textarea
									id="reject-feedback"
									value={feedback}
									onChange={(e) => setFeedback(e.target.value)}
									className="min-h-[100px]"
									placeholder="Explain why you're rejecting this action..."
								/>
							</div>
						</TabsContent>

						<TabsContent value="respond" className="space-y-3">
							<p className="text-sm text-muted-foreground">
								Skip the tool call and send custom feedback to the agent:
							</p>
							<div className="space-y-2">
								<Label htmlFor="respond-feedback">
									Feedback <span className="text-red-500">*</span>
								</Label>
								<Textarea
									id="respond-feedback"
									value={feedback}
									onChange={(e) => {
										setFeedback(e.target.value);
										if (e.target.value.trim()) setParseError(null);
									}}
									className={cn(
										"min-h-[100px]",
										activeTab === "respond" && parseError && "border-red-500",
									)}
									placeholder="Provide instructions or information for the agent..."
								/>
								{activeTab === "respond" && parseError && (
									<p className="text-sm text-red-500">{parseError}</p>
								)}
							</div>
						</TabsContent>
					</Tabs>
				</div>

				<DialogFooter className="flex-shrink-0">
					<Button variant="outline" onClick={onClose} disabled={isLoading}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={
							isLoading ||
							(activeTab === "edit" && !!parseError) ||
							(activeTab === "respond" && !feedback.trim())
						}
						variant={activeTab === "reject" ? "destructive" : "default"}
					>
						{isLoading ? (
							"Processing..."
						) : activeTab === "approve" ? (
							<>
								<Check className="h-4 w-4 mr-1" />
								Approve
							</>
						) : activeTab === "edit" ? (
							<>
								<Edit3 className="h-4 w-4 mr-1" />
								Apply Changes
							</>
						) : activeTab === "reject" ? (
							<>
								<X className="h-4 w-4 mr-1" />
								Reject
							</>
						) : (
							<>
								<MessageSquare className="h-4 w-4 mr-1" />
								Send Feedback
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
