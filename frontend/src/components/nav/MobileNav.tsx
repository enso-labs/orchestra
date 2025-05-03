import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import { Link } from "react-router-dom"
import { ColorModeButton } from "../buttons/ColorModeButton"

interface MobileNavProps {
  onLogout: () => void
}

export function MobileNav({ onLogout }: MobileNavProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden">
          <Menu className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[240px] sm:w-[300px]">
        <div className="flex flex-col space-y-4 mt-4">
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <Link to="/chat" className="text-muted-foreground hover:text-foreground transition-colors">
            Chat
          </Link>
          <Link to="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
            Settings
          </Link>
          <button
            onClick={onLogout}
            className="text-left text-muted-foreground hover:text-foreground transition-colors"
          >
            Logout
          </button>
          <div className="pt-4">
            <ColorModeButton />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
} 