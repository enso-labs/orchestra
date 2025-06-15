import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Settings, LayoutDashboard, Cog } from "lucide-react";
import { Link } from "react-router-dom";

export function SettingsPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline"
          className="w-full justify-start hover:bg-accent hover:text-accent-foreground flex items-center gap-3 p-3 h-auto"
        >
          <div className="flex items-center gap-3 flex-1">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium">JD</span>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium truncate">John Doe</p>
              <p className="text-xs text-muted-foreground truncate">john@example.com</p>
            </div>
            <Settings className="h-4 w-4 flex-shrink-0" />
          </div>
          <span className="sr-only">Open settings menu</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-2" align="end">
        <div className="flex flex-col gap-1">
          <Link to="/dashboard" className="w-full">
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2 text-sm font-normal"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Link to="/settings" className="w-full">
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2 text-sm font-normal"
            >
              <Cog className="h-4 w-4" />
              Settings
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}

