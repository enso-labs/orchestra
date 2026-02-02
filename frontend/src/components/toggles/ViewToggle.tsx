import { Calendar, Table } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ViewToggleProps {
	view: "calendar" | "table";
	onViewChange: (view: "calendar" | "table") => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
	return (
		<Tabs
			value={view}
			onValueChange={(v) => onViewChange(v as "calendar" | "table")}
		>
			<TabsList>
				<TabsTrigger value="calendar" className="gap-1.5">
					<Calendar className="h-4 w-4" />
					Calendar
				</TabsTrigger>
				<TabsTrigger value="table" className="gap-1.5">
					<Table className="h-4 w-4" />
					Table
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}
