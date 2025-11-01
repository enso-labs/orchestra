import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, AlertCircle } from "lucide-react";
import { CRON_PRESETS, getHumanReadableCron } from "@/lib/utils/schedule";

interface CronBuilderProps {
	value: string;
	onChange: (expression: string) => void;
	error?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => ({
	value: i.toString(),
	label: `${i.toString().padStart(2, "0")}:00`,
}));
const DAYS_OF_WEEK = [
	{ value: "0", label: "Sunday" },
	{ value: "1", label: "Monday" },
	{ value: "2", label: "Tuesday" },
	{ value: "3", label: "Wednesday" },
	{ value: "4", label: "Thursday" },
	{ value: "5", label: "Friday" },
	{ value: "6", label: "Saturday" },
];
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => ({
	value: (i + 1).toString(),
	label: (i + 1).toString(),
}));

export const CronBuilder: React.FC<CronBuilderProps> = ({
	value,
	onChange,
	error,
}) => {
	const [mode, setMode] = useState<"preset" | "custom">("preset");
	const [selectedPreset, setSelectedPreset] = useState("");
	const [customExpression, setCustomExpression] = useState(
		value || "0 9 * * *",
	);

	// Parse cron expression for visual builder
	const [minute, hour, dayOfMonth, month, dayOfWeek] = (
		value || "0 9 * * *"
	).split(" ");

	useEffect(() => {
		// Check if current value matches a preset
		const preset = CRON_PRESETS.find((p) => p.value === value);
		if (preset) {
			setSelectedPreset(preset.value);
			setMode("preset");
		} else if (value) {
			setCustomExpression(value);
			setMode("custom");
		}
	}, [value]);

	const handlePresetChange = (presetValue: string) => {
		setSelectedPreset(presetValue);
		onChange(presetValue);
	};

	const handleCustomChange = (expression: string) => {
		setCustomExpression(expression);
		onChange(expression);
	};

	const buildCronExpression = (
		newMinute?: string,
		newHour?: string,
		newDayOfMonth?: string,
		newMonth?: string,
		newDayOfWeek?: string,
	) => {
		const parts = [
			newMinute || minute || "0",
			newHour || hour || "9",
			newDayOfMonth || dayOfMonth || "*",
			newMonth || month || "*",
			newDayOfWeek || dayOfWeek || "*",
		];
		return parts.join(" ");
	};

	const getNextRuns = (): string[] => {
		// This is a simplified version - in a real app you'd use a cron library
		// For now, just show placeholder next runs
		const now = new Date();
		const nextRuns = [];
		for (let i = 1; i <= 3; i++) {
			const nextRun = new Date(now.getTime() + i * 60 * 60 * 1000); // Simplified: add hours
			nextRuns.push(nextRun.toLocaleString());
		}
		return nextRuns;
	};

	return (
		<div className="space-y-4">
			<div className="flex gap-2">
				<Button
					type="button"
					variant={mode === "preset" ? "default" : "outline"}
					size="sm"
					onClick={() => setMode("preset")}
				>
					<Calendar className="w-4 h-4 mr-2" />
					Presets
				</Button>
				<Button
					type="button"
					variant={mode === "custom" ? "default" : "outline"}
					size="sm"
					onClick={() => setMode("custom")}
				>
					<Clock className="w-4 h-4 mr-2" />
					Custom
				</Button>
			</div>

			{mode === "preset" && (
				<div className="space-y-3">
					<Label>Choose a preset schedule</Label>
					<Select value={selectedPreset} onValueChange={handlePresetChange}>
						<SelectTrigger>
							<SelectValue placeholder="Select a preset schedule" />
						</SelectTrigger>
						<SelectContent>
							{CRON_PRESETS.map((preset) => (
								<SelectItem key={preset.value} value={preset.value}>
									<div className="flex flex-col">
										<span>{preset.label}</span>
										<span className="text-xs text-muted-foreground">
											{preset.description}
										</span>
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			{mode === "custom" && (
				<div className="space-y-4">
					<div className="grid grid-cols-2 md:grid-cols-5 gap-3">
						<div>
							<Label className="text-xs">Minute</Label>
							<Input
								value={minute}
								onChange={(e) =>
									handleCustomChange(buildCronExpression(e.target.value))
								}
								placeholder="0"
								className="text-sm"
							/>
						</div>
						<div>
							<Label className="text-xs">Hour</Label>
							<Select
								value={hour}
								onValueChange={(val) =>
									handleCustomChange(buildCronExpression(undefined, val))
								}
							>
								<SelectTrigger className="text-sm">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="*">Every hour</SelectItem>
									{HOURS.map((h) => (
										<SelectItem key={h.value} value={h.value}>
											{h.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<Label className="text-xs">Day of Month</Label>
							<Select
								value={dayOfMonth}
								onValueChange={(val) =>
									handleCustomChange(
										buildCronExpression(undefined, undefined, val),
									)
								}
							>
								<SelectTrigger className="text-sm">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="*">Every day</SelectItem>
									{DAYS_OF_MONTH.map((d) => (
										<SelectItem key={d.value} value={d.value}>
											{d.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<Label className="text-xs">Month</Label>
							<Input
								value={month}
								onChange={(e) =>
									handleCustomChange(
										buildCronExpression(
											undefined,
											undefined,
											undefined,
											e.target.value,
										),
									)
								}
								placeholder="*"
								className="text-sm"
							/>
						</div>
						<div>
							<Label className="text-xs">Day of Week</Label>
							<Select
								value={dayOfWeek}
								onValueChange={(val) =>
									handleCustomChange(
										buildCronExpression(
											undefined,
											undefined,
											undefined,
											undefined,
											val,
										),
									)
								}
							>
								<SelectTrigger className="text-sm">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="*">Every day</SelectItem>
									{DAYS_OF_WEEK.map((d) => (
										<SelectItem key={d.value} value={d.value}>
											{d.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div>
						<Label className="text-xs">Raw Cron Expression</Label>
						<Input
							value={customExpression}
							onChange={(e) => handleCustomChange(e.target.value)}
							placeholder="0 9 * * *"
							className="font-mono text-sm"
						/>
					</div>
				</div>
			)}

			{error && (
				<div className="flex items-center gap-2 text-sm text-destructive">
					<AlertCircle className="w-4 h-4" />
					{error}
				</div>
			)}

			{value && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm">Schedule Preview</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div>
							<Badge variant="secondary" className="font-mono text-xs">
								{value}
							</Badge>
						</div>
						<CardDescription className="text-sm">
							{getHumanReadableCron(value)}
						</CardDescription>
						<div>
							<Label className="text-xs text-muted-foreground">
								Next runs:
							</Label>
							<div className="mt-1 space-y-1">
								{getNextRuns().map((run, index) => (
									<div key={index} className="text-xs text-muted-foreground">
										{run}
									</div>
								))}
							</div>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
};
