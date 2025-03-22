import { useState, useRef } from "react";
import ChatLayout from "../layouts/ChatLayout";
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft, X, Maximize2 } from "lucide-react"
import { useNavigate } from "react-router-dom";
import { useChatContext } from "@/context/ChatContext";
import ChatMessages from "@/components/lists/ChatMessages";
import ChatInput from "@/components/inputs/ChatInput";
import { ChatNav } from "@/components/nav/ChatNav";

export default function CreateAgent() {
  const navigate = useNavigate();
  const { payload, setPayload } = useChatContext()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const { messages } = useChatContext()
  const [activeTab, setActiveTab] = useState("settings") // Mobile uses "settings" or "preview", desktop uses "create" or "configure"
  const [conversationStarters, setConversationStarters] = useState([""])

  const handleAddConversationStarter = () => {
    setConversationStarters([...conversationStarters, ""])
  }

  const handleRemoveConversationStarter = (index: number) => {
    const newStarters = [...conversationStarters]
    newStarters.splice(index, 1)
    setConversationStarters(newStarters)
  }

  return (
    <ChatLayout>
      <div className="flex flex-col md:flex-row h-screen w-full bg-background text-foreground overflow-hidden">
        {/* Mobile Tabs - Only visible on mobile */}
        <div className="md:hidden w-full p-4 pb-0">
          <Tabs value={activeTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-secondary rounded-md">
              <TabsTrigger
                value="settings"
                onClick={() => setActiveTab("settings")}
              >
                Settings
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                onClick={() => setActiveTab("preview")}
              >
                Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Left panel - Settings */}
        <div className={`${
          activeTab === "settings" ? "block" : "hidden"
        } md:block flex-1 p-4 border-b md:border-b-0 md:border-r border-border overflow-y-auto`}>
          <div className="flex items-center mb-6">
            <Button variant="ghost" size="icon" className="mr-2" onClick={() => navigate("/")}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-medium">New Enso</h1>
              <p className="text-xs text-muted-foreground">• Draft</p>
            </div>
            <div className="ml-auto">
              <Button className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">Create</Button>
            </div>
          </div>

          {/* Desktop Tabs - Only visible on desktop */}
          <div className="hidden md:block">
            <Tabs defaultValue="create" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8 bg-secondary rounded-md">
                <TabsTrigger value="create">Create</TabsTrigger>
                <TabsTrigger value="configure">Configure</TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="space-y-6">
                <div className="flex justify-center mb-8">
                  <div className="w-24 h-24 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <span className="text-2xl">+</span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 max-w-full">
                  <div>
                    <label className="block mb-2 text-sm font-medium">Name</label>
                    <Input placeholder="Name your Enso" className="bg-secondary/50 border-border" />
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium">Description</label>
                    <Textarea
                      placeholder="Add a short description about what this Enso does"
                      className="bg-secondary/50 border-border resize-none"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium">System Message</label>
                    <Textarea
                      placeholder="What does this Enso do? How does it behave? What should it avoid doing?"
                      className="bg-secondary/50 border-border resize-none"
                      rows={5}
                      value={payload.system}
                      onChange={(e) => {
                        setPayload({ ...payload, system: e.target.value })
                      }}
                    />
                    <div className="flex justify-end mt-1">
                      <Button variant="ghost" size="icon" className="h-5 w-5">
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium">Conversation starters</label>
                    {conversationStarters.map((starter, index) => (
                      <div key={index} className="flex mb-2 w-full">
                        <Input
                          value={starter}
                          onChange={(e) => {
                            const newStarters = [...conversationStarters]
                            newStarters[index] = e.target.value
                            setConversationStarters(newStarters)
                          }}
                          className="bg-secondary/50 border-border flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveConversationStarter(index)}
                          className="ml-1 flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {conversationStarters.length < 4 && (
                      <Button
                        variant="outline"
                        onClick={handleAddConversationStarter}
                        className="w-full mt-2 border-dashed border-border bg-transparent"
                      >
                        Add starter
                      </Button>
                    )}
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium">Knowledge</label>
                    <p className="text-sm text-muted-foreground">
                      If you upload files under Knowledge, conversations with your Enso may include file contents. Files can
                      be downloaded when Code Interpreter is enabled
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="configure">
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Configuration options would appear here
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Mobile content (no tabs, just the form) */}
          <div className="md:hidden space-y-6">
            <div className="flex justify-center mb-8">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <span className="text-2xl">+</span>
                </Button>
              </div>
            </div>

            <div className="space-y-4 max-w-full">
              <div>
                <label className="block mb-2 text-sm font-medium">Name</label>
                <Input placeholder="Name your Enso" className="bg-secondary/50 border-border" />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Add a short description about what this Enso does"
                  className="bg-secondary/50 border-border resize-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium">System Message</label>
                <Textarea
                  placeholder="What does this Enso do? How does it behave? What should it avoid doing?"
                  className="bg-secondary/50 border-border resize-none"
                  rows={5}
                  value={payload.system}
                  onChange={(e) => {
                    setPayload({ ...payload, system: e.target.value })
                  }}
                />
                <div className="flex justify-end mt-1">
                  <Button variant="ghost" size="icon" className="h-5 w-5">
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium">Conversation starters</label>
                {conversationStarters.map((starter, index) => (
                  <div key={index} className="flex mb-2 w-full">
                    <Input
                      value={starter}
                      onChange={(e) => {
                        const newStarters = [...conversationStarters]
                        newStarters[index] = e.target.value
                        setConversationStarters(newStarters)
                      }}
                      className="bg-secondary/50 border-border flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveConversationStarter(index)}
                      className="ml-1 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {conversationStarters.length < 4 && (
                  <Button
                    variant="outline"
                    onClick={handleAddConversationStarter}
                    className="w-full mt-2 border-dashed border-border bg-transparent"
                  >
                    Add starter
                  </Button>
                )}
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium">Knowledge</label>
                <p className="text-sm text-muted-foreground">
                  If you upload files under Knowledge, conversations with your Enso may include file contents. Files can
                  be downloaded when Code Interpreter is enabled
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel - Preview */}
        <div className={`${
          activeTab === "preview" ? "block" : "hidden"
        } md:block flex-1 flex flex-col h-[50vh] md:h-auto`}>
          <ChatNav
            onMenuClick={() => setIsDrawerOpen(!isDrawerOpen)}
          />

          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            <div className="space-y-4 max-w-4xl mx-auto pb-4">
              <ChatMessages messages={messages} />
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          <div className="sticky bottom-0 bg-background border-border">
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-col gap-2 p-4 pb-25">
                <ChatInput />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ChatLayout>
  );
} 