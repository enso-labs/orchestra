import { Button } from "@/components/ui/button";
import { useIntro } from "@/contexts/IntroContext";
import { HelpCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  TOUR_IDS,
  firstTimeUserSteps,
  chatInterfaceSteps,
  agentCreationSteps,
  schedulesSteps,
} from "@/lib/intro/steps";

export function TourButton() {
  const { startTour, resetTours, skipAllTours, setSkipAllTours } = useIntro();

  const tours = [
    { id: TOUR_IDS.FIRST_TIME, name: "First-Time User Tour", steps: firstTimeUserSteps },
    { id: TOUR_IDS.CHAT_INTERFACE, name: "Chat Interface Tour", steps: chatInterfaceSteps },
    { id: TOUR_IDS.AGENT_CREATION, name: "Agent Creation Tour", steps: agentCreationSteps },
    { id: TOUR_IDS.SCHEDULES, name: "Schedules Tour", steps: schedulesSteps },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" title="Help & Tours">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {tours.map((tour) => (
          <DropdownMenuItem
            key={tour.id}
            onClick={() => startTour(tour.id, tour.steps)}
          >
            {tour.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => resetTours()}>
          Reset All Tours
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setSkipAllTours(!skipAllTours)}>
          {skipAllTours ? "Enable" : "Disable"} Auto Tours
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
