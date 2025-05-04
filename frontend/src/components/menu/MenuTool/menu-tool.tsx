import { MoreHorizontal, Wrench } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/context/AppContext";
export function MenuTool() {
	const { handleMenuOpen } = useAppContext();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
				<Button variant="outline" size="icon" className="rounded-full bg-foreground/10 text-foreground-500 px-3 hover:bg-foreground/15 transition-colors">
					<MoreHorizontal className="h-4 w-4" />
				</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem className="flex items-center gap-2 cursor-pointer" onClick={handleMenuOpen}>
          <Wrench className="h-4 w-4" />
					<span>More Tools</span>
        </DropdownMenuItem>
        {/* <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
          <Copy className="h-4 w-4" />
          <span>Duplicate</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
          <Share className="h-4 w-4" />
          <span>Share</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
          <Download className="h-4 w-4" />
          <span>Download</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="flex items-center gap-2 cursor-pointer text-destructive">
          <Trash className="h-4 w-4" />
          <span>Delete</span>
        </DropdownMenuItem> */}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default MenuTool;