import { useCallback, useMemo } from "react";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import type { CronEvent } from "@/lib/entities/cron";
import { getExecutionStatusColor } from "@/lib/utils/calendar";
import "@/styles/calendar.css";

const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
	format,
	parse,
	startOfWeek,
	getDay,
	locales,
});

interface CronCalendarProps {
	events: CronEvent[];
	onEventClick?: (event: CronEvent) => void;
}

export function CronCalendar({
	events,
	onEventClick,
}: CronCalendarProps) {
	const eventStyleGetter = useCallback((event: CronEvent) => {
		const backgroundColor = getExecutionStatusColor(event.resource.status);
		return {
			style: {
				backgroundColor,
				borderRadius: "4px",
				opacity: 0.9,
				color: "white",
				border: "none",
				display: "block",
			},
		};
	}, []);

	const handleSelectEvent = useCallback(
		(event: CronEvent) => {
			onEventClick?.(event);
		},
		[onEventClick],
	);

	const defaultView: View = "month";
	const views: View[] = useMemo(() => ["month", "week", "day"], []);

	return (
		<div className="cron-calendar h-full min-h-[600px] pb-6">
			<Calendar<CronEvent>
				localizer={localizer}
				events={events}
				defaultView={defaultView}
				views={views}
				eventPropGetter={eventStyleGetter}
				onSelectEvent={handleSelectEvent}
				popup
				style={{ height: "calc(100% - 24px)" }}
			/>
		</div>
	);
}
