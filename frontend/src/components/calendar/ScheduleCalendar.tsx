import { useCallback, useMemo } from "react";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import type { ScheduleEvent } from "@/lib/entities/schedule";
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

interface ScheduleCalendarProps {
	events: ScheduleEvent[];
	onEventClick?: (event: ScheduleEvent) => void;
}

export function ScheduleCalendar({
	events,
	onEventClick,
}: ScheduleCalendarProps) {
	const eventStyleGetter = useCallback(
		(event: ScheduleEvent) => {
			const backgroundColor = getExecutionStatusColor(
				event.resource.status,
			);
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
		},
		[],
	);

	const handleSelectEvent = useCallback(
		(event: ScheduleEvent) => {
			onEventClick?.(event);
		},
		[onEventClick],
	);

	const defaultView: View = "month";
	const views: View[] = useMemo(() => ["month", "week", "day"], []);

	return (
		<div className="schedule-calendar h-full min-h-[600px]">
			<Calendar<ScheduleEvent>
				localizer={localizer}
				events={events}
				defaultView={defaultView}
				views={views}
				eventPropGetter={eventStyleGetter}
				onSelectEvent={handleSelectEvent}
				popup
				style={{ height: "100%" }}
			/>
		</div>
	);
}
