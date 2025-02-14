import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function MainToolTip({ children, content, delayDuration = 100 }: { children: React.ReactNode, content: string, delayDuration?: number }) {
    return (
        <TooltipProvider>
            <Tooltip delayDuration={delayDuration}>
                <TooltipTrigger asChild>
                    {children}
                </TooltipTrigger>
                <TooltipContent>
                    <p>{content}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}