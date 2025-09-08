import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, X } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export interface ActionConfig {
	[key: string]: unknown;
}

export interface Action {
	id: string;
	name: string;
	type: "api" | "function" | "webhook" | "custom";
	description?: string;
	config: ActionConfig;
	enabled: boolean;
}

const actionTypes = [
	{
		value: "api",
		label: "API Call",
		description: "Make HTTP requests to external APIs",
	},
	{
		value: "function",
		label: "Function",
		description: "Execute custom JavaScript functions",
	},
	{
		value: "webhook",
		label: "Webhook",
		description: "Send data to webhook endpoints",
	},
	{
		value: "custom",
		label: "Custom",
		description: "Define custom action logic",
	},
];

export default function ActionsManager() {
	const [actions, setActions] = useState<Action[]>([]);
	const [selectedAction, setSelectedAction] = useState<Action | null>(null);
	const [isAddingAction, setIsAddingAction] = useState(false);
	const [newActionType, setNewActionType] = useState<string>("");
	const [newActionName, setNewActionName] = useState("");
	const [newActionDescription, setNewActionDescription] = useState("");

	const handleAddAction = () => {
		if (!newActionType || !newActionName.trim()) return;

		const newAction: Action = {
			id: `action_${Date.now()}`,
			name: newActionName,
			type: newActionType as Action["type"],
			description: newActionDescription,
			config: {},
			enabled: true,
		};

		setActions([...actions, newAction]);
		setIsAddingAction(false);
		setNewActionType("");
		setNewActionName("");
		setNewActionDescription("");
	};

	const handleRemoveAction = (actionId: string) => {
		setActions(actions.filter((action) => action.id !== actionId));
		if (selectedAction?.id === actionId) {
			setSelectedAction(null);
		}
	};

	const handleToggleAction = (actionId: string) => {
		setActions(
			actions.map((action) =>
				action.id === actionId
					? { ...action, enabled: !action.enabled }
					: action,
			),
		);
	};

	const getActionTypeColor = (type: Action["type"]) => {
		switch (type) {
			case "api":
				return "default";
			case "function":
				return "secondary";
			case "webhook":
				return "outline";
			case "custom":
				return "destructive";
			default:
				return "default";
		}
	};

	return (
		<div>
			<div className="flex items-center justify-between mb-4">
				<label className="block text-sm font-medium">Actions</label>
				<Button
					variant="outline"
					size="sm"
					onClick={() => setIsAddingAction(true)}
					className="border-dashed"
				>
					<Plus className="h-4 w-4 mr-1" />
					Add Action
				</Button>
			</div>

			{/* Actions Chips */}
			<div className="flex flex-wrap gap-2 mb-4">
				{actions.map((action) => (
					<div key={action.id} className="relative group">
						<Badge
							variant={
								action.enabled ? getActionTypeColor(action.type) : "outline"
							}
							className={`cursor-pointer transition-all hover:shadow-md ${
								selectedAction?.id === action.id
									? "ring-2 ring-ring ring-offset-1"
									: ""
							} ${!action.enabled ? "opacity-50" : ""}`}
							onClick={() => setSelectedAction(action)}
						>
							<span className="mr-2">{action.name}</span>
							<span className="text-xs opacity-70">({action.type})</span>
							<Button
								variant="ghost"
								size="sm"
								className="h-4 w-4 p-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
								onClick={(e) => {
									e.stopPropagation();
									handleRemoveAction(action.id);
								}}
							>
								<X className="h-3 w-3" />
							</Button>
						</Badge>
					</div>
				))}
				{actions.length === 0 && (
					<p className="text-sm text-muted-foreground">
						No actions added yet. Click "Add Action" to get started.
					</p>
				)}
			</div>

			{/* Selected Action Configuration */}
			{selectedAction && (
				<div className="border rounded-lg p-4 bg-card">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2">
							<Settings className="h-4 w-4" />
							<h3 className="font-medium">{selectedAction.name}</h3>
							<Badge
								variant={getActionTypeColor(selectedAction.type)}
								className="text-xs"
							>
								{selectedAction.type}
							</Badge>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => handleToggleAction(selectedAction.id)}
							>
								{selectedAction.enabled ? "Disable" : "Enable"}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setSelectedAction(null)}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					</div>

					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium mb-1">
								Description
							</label>
							<p className="text-sm text-muted-foreground">
								{selectedAction.description || "No description provided"}
							</p>
						</div>

						{/* Action Type Specific Configuration */}
						{selectedAction.type === "api" && (
							<div className="space-y-3">
								<div>
									<label className="block text-sm font-medium mb-1">
										API Endpoint
									</label>
									<Input placeholder="https://api.example.com/endpoint" />
								</div>
								<div>
									<label className="block text-sm font-medium mb-1">
										Method
									</label>
									<Select>
										<SelectTrigger>
											<SelectValue placeholder="Select HTTP method" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="GET">GET</SelectItem>
											<SelectItem value="POST">POST</SelectItem>
											<SelectItem value="PUT">PUT</SelectItem>
											<SelectItem value="DELETE">DELETE</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div>
									<label className="block text-sm font-medium mb-1">
										Headers
									</label>
									<Textarea placeholder="Enter headers as JSON" rows={3} />
								</div>
							</div>
						)}

						{selectedAction.type === "function" && (
							<div className="space-y-3">
								<div>
									<label className="block text-sm font-medium mb-1">
										Function Code
									</label>
									<Textarea
										placeholder="function execute(input) { return input; }"
										rows={6}
										className="font-mono text-sm"
									/>
								</div>
							</div>
						)}

						{selectedAction.type === "webhook" && (
							<div className="space-y-3">
								<div>
									<label className="block text-sm font-medium mb-1">
										Webhook URL
									</label>
									<Input placeholder="https://your-webhook-url.com" />
								</div>
								<div>
									<label className="block text-sm font-medium mb-1">
										Secret
									</label>
									<Input
										type="password"
										placeholder="Optional webhook secret"
									/>
								</div>
							</div>
						)}

						{selectedAction.type === "custom" && (
							<div className="space-y-3">
								<div>
									<label className="block text-sm font-medium mb-1">
										Configuration
									</label>
									<Textarea
										placeholder="Enter custom configuration as JSON"
										rows={4}
									/>
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Add Action Dialog */}
			<Dialog open={isAddingAction} onOpenChange={setIsAddingAction}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add New Action</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium mb-2">
								Action Type
							</label>
							<Select value={newActionType} onValueChange={setNewActionType}>
								<SelectTrigger>
									<SelectValue placeholder="Select action type" />
								</SelectTrigger>
								<SelectContent>
									{actionTypes.map((type) => (
										<SelectItem key={type.value} value={type.value}>
											<div>
												<div className="font-medium">{type.label}</div>
												<div className="text-xs text-muted-foreground">
													{type.description}
												</div>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div>
							<label className="block text-sm font-medium mb-2">Name</label>
							<Input
								placeholder="Enter action name"
								value={newActionName}
								onChange={(e) => setNewActionName(e.target.value)}
							/>
						</div>

						<div>
							<label className="block text-sm font-medium mb-2">
								Description (Optional)
							</label>
							<Textarea
								placeholder="Describe what this action does"
								value={newActionDescription}
								onChange={(e) => setNewActionDescription(e.target.value)}
								rows={3}
							/>
						</div>

						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								onClick={() => setIsAddingAction(false)}
							>
								Cancel
							</Button>
							<Button
								onClick={handleAddAction}
								disabled={!newActionType || !newActionName.trim()}
							>
								Add Action
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
