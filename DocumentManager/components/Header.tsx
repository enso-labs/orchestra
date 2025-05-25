import { Button } from "@/components/ui/button"
import { Sheet, SheetTrigger } from "@/components/ui/sheet"
import { MessageSquare, Menu } from "lucide-react"

interface HeaderProps {
  collectionName: string
  onMenuClick: () => void
}

export function Header({ collectionName, onMenuClick }: HeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="md:hidden h-8 w-8 p-0" onClick={onMenuClick}>
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
        </Sheet>

        <div>
          <h1 className="text-lg font-medium mb-1">{collectionName} Documents</h1>
          <p className="text-sm text-muted-foreground">Manage documents in this collection</p>
        </div>
      </div>

      <Button className="w-full sm:w-auto">
        <MessageSquare className="h-4 w-4 mr-2" />
        <span className="hidden sm:inline">Chat with your documents</span>
        <span className="sm:hidden">Chat</span>
      </Button>
    </div>
  )
} 