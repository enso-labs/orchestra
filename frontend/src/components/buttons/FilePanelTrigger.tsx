import { FolderCode, FileText } from "lucide-react";
import { useChatContext } from "@/context/ChatContext";
import { Button } from "@/components/ui/button";

interface FilePanelTriggerProps {
  variant?: "compact" | "full";
}

export default function FilePanelTrigger({
  variant = "compact",
}: FilePanelTriggerProps) {
  const { viewMode, setViewMode, filesMap } = useChatContext();

  const fileCount = Array.from(filesMap?.values() || []).reduce(
    (acc: number, files: any) => acc + Object.keys(files || {}).length,
    0,
  );

  const hasFiles = filesMap.size > 0;

  if (!hasFiles) return null;

  const isActive = viewMode === "editor";

  const handlePress = () => {
    setViewMode(isActive ? "chat" : "editor");
  };

  if (variant === "compact") {
    return (
      <Button
        variant={isActive ? "secondary" : "default"}
        size="sm"
        className="rounded-xl h-9 px-2 gap-1 relative w-9 p-0 justify-center"
        onClick={handlePress}
        title={isActive ? "Back to Chat" : "Open Files"}
        aria-label={isActive ? "Back to Chat" : "Open Files"}
      >
        <FolderCode className="h-4 w-4" />
        {fileCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
            {fileCount}
          </span>
        )}
      </Button>
    );
  }

  return (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      size="sm"
      className="h-8 gap-2"
      onClick={handlePress}
      aria-label={isActive ? "Back to Chat" : "Open Files"}
      aria-pressed={isActive}
    >
      <FileText className="h-4 w-4" />
      <span className="hidden sm:inline">
        Files{fileCount > 0 ? ` (${fileCount})` : ""}
      </span>
      {fileCount > 0 && (
        <span className="sm:hidden absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
          {fileCount}
        </span>
      )}
    </Button>
  );
}
