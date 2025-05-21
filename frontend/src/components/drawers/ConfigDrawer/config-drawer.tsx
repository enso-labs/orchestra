import { useState } from "react"
import { Settings, X } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ToolsTab } from "./tools-tab"
import TabContentInfo from "./tabs/tab-content-info"

export default function ConfigDrawer() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="z-10 rounded-full"
        onClick={() => setOpen(true)}
      >
        <Settings className="h-5 w-5" />
        <span className="sr-only">Settings</span>
      </Button>

      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setOpen(false)}
      />

      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md transform transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="h-full overflow-y-auto bg-background border-l border-border">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-xl font-semibold">Settings</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          <div className="p-4">
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid grid-cols-5">
                <TabsTrigger value="info">
                  <span className="md:inline">Info</span>
                </TabsTrigger>
                <TabsTrigger value="tools">
                  <span className="md:inline">Tools</span>
                </TabsTrigger>
                <TabsTrigger value="mcp">
                  <span className="md:inline">MCP</span>
                </TabsTrigger>
                <TabsTrigger value="a2a">
                  <span className="md:inline">A2A</span>
                </TabsTrigger>
                <TabsTrigger value="arcade">
                  <span className="md:inline">Arcade</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4">
                <TabContentInfo />
              </TabsContent>

              <TabsContent value="tools" className="mt-4">
                <ToolsTab />
              </TabsContent>

              <TabsContent value="mcp" className="mt-4">
                <ToolsTab category="MCP" />
              </TabsContent>

              <TabsContent value="a2a" className="mt-4">
                <ToolsTab category="A2A" />
              </TabsContent>

              <TabsContent value="arcade" className="mt-4">
                <ToolsTab category="Arcade" />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </>
  )
}