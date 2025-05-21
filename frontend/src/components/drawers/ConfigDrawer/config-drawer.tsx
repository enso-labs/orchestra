import { useState } from "react"
import { Settings, X, Moon, Sun } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToolsTab } from "./tools-tab"

export default function ConfigDrawer() {
  const [open, setOpen] = useState(false)
  const { setTheme, theme } = useTheme()

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
        <div className="h-full overflow-y-auto bg-black border-l border-neutral-800">
          <div className="flex items-center justify-between p-4 border-b border-neutral-800">
            <h2 className="text-xl font-semibold text-white">Settings</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="text-neutral-400 hover:text-white hover:bg-neutral-800"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                {theme === "dark" ? (
                  <Moon className="h-5 w-5 text-neutral-300" />
                ) : (
                  <Sun className="h-5 w-5 text-neutral-300" />
                )}
                <Label htmlFor="theme-mode" className="text-neutral-300">
                  Dark Mode
                </Label>
              </div>
              <Switch
                id="theme-mode"
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                className="data-[state=checked]:bg-neutral-300"
              />
            </div>

            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid grid-cols-5 bg-neutral-900 text-neutral-400">
                <TabsTrigger value="info" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-white">
                  <span className="md:inline">Info</span>
                </TabsTrigger>
                <TabsTrigger
                  value="tools"
                  className="data-[state=active]:bg-neutral-800 data-[state=active]:text-white"
                >
                  <span className="md:inline">Tools</span>
                </TabsTrigger>
                <TabsTrigger value="mcp" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-white">
                  <span className="md:inline">MCP</span>
                </TabsTrigger>
                <TabsTrigger value="a2a" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-white">
                  <span className="md:inline">A2A</span>
                </TabsTrigger>
                <TabsTrigger
                  value="arcade"
                  className="data-[state=active]:bg-neutral-800 data-[state=active]:text-white"
                >
                  <span className="md:inline">Arcade</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4 text-neutral-300">
                <div className="space-y-6">
                  <h3 className="text-lg font-medium">Model Selection</h3>
                  <div className="space-y-4">
                    <Label htmlFor="model-select">Select Model</Label>
                    <Select defaultValue="gpt-4">
                      <SelectTrigger id="model-select" className="w-full bg-neutral-800 border-neutral-700">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-800 border-neutral-700">
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                        <SelectItem value="claude-2">Claude 2</SelectItem>
                        <SelectItem value="llama-2">Llama 2</SelectItem>
                        <SelectItem value="palm">PaLM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Test Area</h3>
                    <div className="rounded-md bg-neutral-800 p-4 min-h-[200px] border border-neutral-700">
                      <Textarea
                        placeholder="Enter test prompt here..."
                        className="bg-neutral-900 border-neutral-700 min-h-[150px]"
                      />
                      <Button className="mt-4 w-full bg-neutral-700 hover:bg-neutral-600">Run Test</Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="tools" className="mt-4 text-neutral-300">
                <ToolsTab />
              </TabsContent>

              <TabsContent value="mcp" className="mt-4 text-neutral-300">
                <ToolsTab category="MCP" />
              </TabsContent>

              <TabsContent value="a2a" className="mt-4 text-neutral-300">
                <ToolsTab category="A2A" />
              </TabsContent>

              <TabsContent value="arcade" className="mt-4 text-neutral-300">
                <ToolsTab category="Arcade" />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </>
  )
}