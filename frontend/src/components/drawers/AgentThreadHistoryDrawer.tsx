import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatContext } from "@/context/ChatContext";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { combineToolMessages, truncateFrom } from "@/lib/utils/format";
import { SettingsPopover } from "../popovers/SettingsPopover";
import { Link } from "react-router-dom";

interface AgentThreadHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentThreadHistoryDrawer({ isOpen, onClose }: AgentThreadHistoryDrawerProps) {
  const { history, setMessages, setPayload, deleteThread, payload } = useChatContext();

  const handleThreadClick = (threadId: string, messages: any[]) => {
    setMessages(combineToolMessages(messages));
    setPayload((prev: any) => ({ ...prev, threadId }));
    onClose(); // Close drawer after selection on mobile
  };

  const handleDeleteClick = async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation(); // Prevent thread selection when clicking delete
    
    if (window.confirm('Are you sure you want to delete this thread?')) {
      try {
        await deleteThread(threadId);
      } catch (error) {
        alert('Failed to delete thread');
      }
    }
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
        absolute md:relative w-[300px] border-r border-border flex flex-col h-[calc(100vh-0px)]
        ${isOpen ? 'flex' : 'hidden md:flex'}
        bg-background z-40
      `}>
          <div className="p-4 border-b border-border">
              <Link to="/"><h1 className="text-2xl font-bold text-foreground">Enso</h1></Link>
          </div>

          <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                  {history?.threads?.sort((a: any, b: any) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).map((thread: any) => (
                      <div
                          key={thread.thread_id}
                          className="group relative"
                      >
                          <button
                              onClick={() =>
                                  handleThreadClick(
                                      thread.thread_id,
                                      thread.messages
                                  )
                              }
                              className={`w-full text-left p-3 rounded-lg transition-colors border ${
                                payload.threadId === thread.thread_id 
                                  ? 'bg-accent border-accent' 
                                  : 'hover:bg-accent/50 border-border'
                              }`}
                          >
                              <div className="w-full pr-8">
                                  <p className="text-sm font-medium line-clamp-2 max-w-60">
                                      {thread.messages[1]?.content && typeof(thread.messages[1]?.content) === "string" ? truncateFrom(thread.messages[1].content, 'end', "...", 70) : "New Chat"}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1 truncate">
                                      {formatDistanceToNow(new Date(thread.ts), {
                                          addSuffix: true,
                                      })}
                                  </p>
                              </div>
                          </button>
                          <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => handleDeleteClick(e, thread.thread_id)}
                          >
                              <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4 text-muted-foreground hover:text-destructive"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                              >
                                  <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                              </svg>
                          </Button>
                      </div>
                  ))}
              </div>
          </ScrollArea>

          <div className="p-4 border-t border-border">
              <SettingsPopover />
          </div>
      </div>
    </>
  );
} 