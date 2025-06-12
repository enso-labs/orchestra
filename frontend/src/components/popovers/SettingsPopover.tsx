import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Settings } from "lucide-react";
import { Link } from "react-router-dom";

export function SettingsPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full" onClick={() => {}}>
            <Settings className="mr-2 h-4 w-4" />
            Menu
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="center" side="top">
        <div className="grid gap-4">
          {/* <h4 className="font-medium leading-none">Navigation</h4> */}
          <div className="grid gap-2">
            <Link to="/dashboard">
              <Button variant="outline" className="w-full justify-start">
                Dashboard
              </Button>
            </Link>
            <Link to="/tools/create">
              <Button variant="outline" className="w-full justify-start">
                Tools
              </Button>
            </Link>
            <Link to="/settings">
              <Button variant="outline" className="w-full justify-start">
                Settings
              </Button>
            </Link>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

