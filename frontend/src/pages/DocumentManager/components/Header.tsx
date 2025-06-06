import { Button } from "@/components/ui/button"
import { Sheet, SheetTrigger } from "@/components/ui/sheet"
import { MessageSquare, Menu, Edit, Trash2 } from "lucide-react"

interface HeaderProps {
  title: string
  description: string
  onMenuClick?: () => void
  onChatClick?: () => void
  onEditClick?: () => void
  onDeleteClick?: () => void
  showMobileMenu?: boolean
}

export function Header({
  title,
  description,
  onMenuClick,
  onChatClick,
  onEditClick,
  onDeleteClick,
  showMobileMenu = false,
}: HeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        {showMobileMenu && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="md:hidden h-8 w-8 p-0" onClick={onMenuClick}>
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
          </Sheet>
        )}

        <div>
          <h1 className="text-lg font-medium mb-1">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Collection Actions */}
        {(onEditClick || onDeleteClick) && (
          <div className="flex items-center gap-1">
            {onEditClick && (
              <Button variant="ghost" size="sm" onClick={onEditClick} className="h-8 w-8 p-0">
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDeleteClick && (
              <Button variant="ghost" size="sm" onClick={onDeleteClick} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {onChatClick && (
          <Button className="w-full sm:w-auto" onClick={onChatClick}>
            <MessageSquare className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Chat with your documents</span>
            <span className="sm:hidden">Chat</span>
          </Button>
        )}
      </div>
    </div>
  )
} 