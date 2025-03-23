import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useState, useEffect } from "react";

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
}

export function ChatDrawer({ 
  isOpen, 
  onClose, 
  children, 
  defaultWidth = 320,
  minWidth = 280,
}: ChatDrawerProps) {
  const [width, setWidth] = useState(defaultWidth);
  
  // Ensure component properly updates when resized
  useEffect(() => {
    if (isOpen) {
      // Update CSS variable to maintain the correct padding in parent containers
      document.documentElement.style.setProperty('--chat-drawer-width', `${width}px`);
    }
    return () => {
      // Clean up when unmounted
      document.documentElement.style.removeProperty('--chat-drawer-width');
    }
  }, [isOpen, width]);

  // Handle manual resizing with mouse
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    const startX = e.pageX;
    const startWidth = width;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.pageX - startX;
      const newWidth = Math.max(minWidth, startWidth - deltaX);
      setWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

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
        fixed right-0 top-0 h-full border-l border-border
        transform transition-all duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        bg-background/80 backdrop-blur-sm
      `} style={{ zIndex: 60, width: `${width}px` }}>
        {/* Custom resize handle */}
        <div 
          className="absolute left-0 top-0 h-full w-4 cursor-ew-resize flex items-center justify-center hover:bg-background/20"
          onMouseDown={handleMouseDown}
        >
          <div className="w-1 h-8 bg-border rounded-full" />
        </div>
        
        <div className="flex h-full flex-col pl-4">
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