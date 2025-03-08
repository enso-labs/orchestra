import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function ChatDrawer({ isOpen, onClose, children }: ChatDrawerProps) {
  return (
    <>
      {/* Overlay for mobile - only shows when drawer is open */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden" 
          onClick={onClose}
        />
      )}
      
      <div className={`
        fixed right-0 top-0 h-full w-[320px] border-l border-border
        transform transition-all duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        bg-background/80 backdrop-blur-sm
      `} style={{ zIndex: 60 }}>
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-lg font-semibold">Action Log</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              {children}
            </div>
          </ScrollArea>
        </div>
      </div>
    </>
  );
} 