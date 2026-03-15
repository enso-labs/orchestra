import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Heart,
	Play,
	ChevronDown,
	ChevronRight,
	CheckCircle2,
	AlertTriangle,
	SkipForward,
} from "lucide-react";
import type {
	HeartbeatConfig,
	HeartbeatState,
	HeartbeatTickResult,
} from "@/lib/entities/heartbeat";
import { HEARTBEAT_INTERVALS } from "@/lib/entities/heartbeat";

interface Agent {
	id: string;
	name: string;
}

interface HeartbeatSectionProps {
	config: HeartbeatConfig | null;
	state: HeartbeatState | null;
	history: HeartbeatTickResult[];
	agents: Agent[];
	loading: boolean;
	onSave: (data: Partial<HeartbeatConfig>) => Promise<void>;
	onDelete: () => Promise<void>;
	onTriggerTick: () => Promise<void>;
}

export function HeartbeatSection({
	config,
	state,
	history,
	agents,
	loading,
	onSave,
	onDelete,
	onTriggerTick,
}: HeartbeatSectionProps) {
	const [isOpen, setIsOpen] = useState(!!config?.enabled);
	const [enabled, setEnabled] = useState(config?.enabled ?? false);
	const [assistantId, setAssistantId] = useState(config?.assistant_id ?? "");
	const [checklist, setChecklist] = useState(config?.checklist ?? "");
	const [everySeconds, setEverySeconds] = useState(
		config?.every_seconds ?? 3600,
	);
	const [activeStart, setActiveStart] = useState(
		config?.active_hours?.start ?? "09:00",
	);
	const [activeEnd, setActiveEnd] = useState(
		config?.active_hours?.end ?? "22:00",
	);

	const handleToggle = (checked: boolean) => {
		setEnabled(checked);
		if (!checked && config?.enabled) {
			onSave({ ...config, enabled: false });
		}
	};

	const handleSave = () => {
		onSave({
			assistant_id: assistantId,
			enabled,
			checklist,
			every_seconds: everySeconds,
			active_hours: {
				start: activeStart,
				end: activeEnd,
				timezone: config?.active_hours?.timezone ?? "UTC",
			},
			isolated_session: config?.isolated_session ?? true,
			light_context: config?.light_context ?? true,
			ack_max_chars: config?.ack_max_chars ?? 300,
		});
	};

	const formatTimestamp = (ts: string) => {
		try {
			return new Date(ts).toLocaleString();
		} catch {
			return ts;
		}
	};

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<Card className="mb-4">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
							{isOpen ? (
								<ChevronDown className="h-4 w-4" />
							) : (
								<ChevronRight className="h-4 w-4" />
							)}
							<Heart className="h-5 w-5 text-red-500" />
							<CardTitle className="text-lg">Heartbeat Monitor</CardTitle>
							{config?.enabled && (
								<Badge
									variant="outline"
									className="text-green-500 border-green-500/30 ml-2"
								>
									Active
								</Badge>
							)}
						</CollapsibleTrigger>
						<Switch
							data-testid="heartbeat-toggle"
							checked={enabled}
							onCheckedChange={handleToggle}
						/>
					</div>
				</CardHeader>

				<CollapsibleContent>
					<CardContent className="space-y-4">
						{/* Agent selector */}
						<div className="space-y-1.5">
							<label className="text-sm font-medium">Agent</label>
							<Select value={assistantId} onValueChange={setAssistantId}>
								<SelectTrigger>
									<SelectValue placeholder="Select an agent" />
								</SelectTrigger>
								<SelectContent>
									{agents.map((agent) => (
										<SelectItem key={agent.id} value={agent.id}>
											{agent.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Checklist */}
						<div className="space-y-1.5">
							<label className="text-sm font-medium">Checklist</label>
							<Textarea
								data-testid="heartbeat-checklist"
								className="font-mono text-sm min-h-[100px]"
								placeholder="- [ ] Check inbox&#10;- [ ] Review alerts&#10;- [ ] Monitor dashboards"
								value={checklist}
								onChange={(e) => setChecklist(e.target.value)}
							/>
						</div>

						{/* Interval */}
						<div className="space-y-1.5">
							<label className="text-sm font-medium">Check Interval</label>
							<Select
								value={String(everySeconds)}
								onValueChange={(v) => setEverySeconds(Number(v))}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{HEARTBEAT_INTERVALS.map((interval) => (
										<SelectItem
											key={interval.value}
											value={String(interval.value)}
										>
											{interval.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Active hours */}
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<label className="text-sm font-medium">Active From</label>
								<Input
									data-testid="active-hours-start"
									type="time"
									value={activeStart}
									onChange={(e) => setActiveStart(e.target.value)}
								/>
							</div>
							<div className="space-y-1.5">
								<label className="text-sm font-medium">Active Until</label>
								<Input
									data-testid="active-hours-end"
									type="time"
									value={activeEnd}
									onChange={(e) => setActiveEnd(e.target.value)}
								/>
							</div>
						</div>

						{/* Action buttons */}
						<div className="flex gap-2 pt-2">
							<Button onClick={handleSave} disabled={loading}>
								Save
							</Button>
							{config?.enabled && (
								<>
									<Button
										variant="outline"
										onClick={onTriggerTick}
										disabled={loading}
									>
										<Play className="h-4 w-4 mr-1" />
										Test Tick
									</Button>
									<Button
										variant="destructive"
										onClick={onDelete}
										disabled={loading}
									>
										Disable
									</Button>
								</>
							)}
						</div>

						{/* Status card - only when enabled */}
						{config?.enabled && state && (
							<Card className="bg-muted/50">
								<CardContent className="p-4">
									<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
										<div>
											<p className="text-xs text-muted-foreground">Last Run</p>
											<p className="text-sm font-medium">
												{state.last_run_at
													? formatTimestamp(state.last_run_at)
													: "Never"}
											</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground">Next Due</p>
											<p className="text-sm font-medium">
												{state.next_due_at
													? formatTimestamp(state.next_due_at)
													: "N/A"}
											</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground">
												Consecutive OKs
											</p>
											<p className="text-sm font-medium">
												{state.consecutive_ok_count}
											</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground">
												Ticks / Escalations
											</p>
											<p className="text-sm font-medium">
												{state.total_ticks} / {state.total_escalations}
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
						)}

						{/* Activity timeline - only when enabled */}
						{config?.enabled && history.length > 0 && (
							<div className="space-y-2">
								<h4 className="text-sm font-medium">Recent Activity</h4>
								<div className="space-y-1.5">
									{history.slice(0, 10).map((entry, i) => (
										<div
											key={i}
											className="flex items-start gap-2 text-sm py-1"
										>
											{entry.action === "ok" && (
												<CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
											)}
											{entry.action === "escalated" && (
												<AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
											)}
											{entry.action === "skipped" && (
												<SkipForward className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
											)}
											<div className="flex-1 min-w-0">
												<span className="text-muted-foreground">
													{formatTimestamp(entry.timestamp)}
												</span>
												<span className="mx-1">-</span>
												<span>{entry.reason}</span>
												{entry.duration_ms != null && (
													<span className="text-muted-foreground ml-1">
														({entry.duration_ms}ms)
													</span>
												)}
											</div>
										</div>
									))}
								</div>
							</div>
						)}
					</CardContent>
				</CollapsibleContent>
			</Card>
		</Collapsible>
	);
}
