import { Button } from "@/components/ui/button"

interface DocumentTabsProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function DocumentTabs({ activeTab, onTabChange }: DocumentTabsProps) {
  return (
    <div className="flex gap-1 mb-6">
      <Button
        variant={activeTab === "upload" ? "default" : "ghost"}
        onClick={() => onTabChange("upload")}
        className="text-sm"
      >
        Upload File
      </Button>
      <Button
        variant={activeTab === "text" ? "default" : "ghost"}
        onClick={() => onTabChange("text")}
        className="text-sm"
      >
        Add Text
      </Button>
    </div>
  )
} 