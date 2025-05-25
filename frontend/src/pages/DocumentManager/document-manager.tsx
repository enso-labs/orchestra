import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Upload, MessageSquare, MoreHorizontal, Plus, Edit, Trash2, X, FolderPlus, Menu } from "lucide-react"

export default function DocumentManager() {
  const [activeTab, setActiveTab] = useState("upload")
  const [showCollectionMenu, setShowCollectionMenu] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState("")
  const [newCollectionDescription, setNewCollectionDescription] = useState("")
  const [textContent, setTextContent] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const documents = [
    {
      name: "Enso Labs Q3 2025 Growth Strategy_ Developers, Monetization & Community.pdf",
      collection: "Test",
      dateUploaded: "05/20/2025 12:27 PM",
    },
  ]

  const handleCreateCollection = () => {
    setShowCreateModal(false)
    setNewCollectionName("")
    setNewCollectionDescription("")
  }

  const SidebarContent = () => (
    <div className="p-4 md:p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium">Collections</h2>
        <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(true)} className="h-8 w-8 p-0">
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <DropdownMenu open={showCollectionMenu} onOpenChange={setShowCollectionMenu}>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer group">
                <span>Test</span>
                <MoreHorizontal className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32">
              <DropdownMenuItem className="flex items-center gap-2">
                <Edit className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen">
      <div className="flex h-[calc(100vh-22rem)]">
        {/* Desktop Sidebar */}
        <div className="hidden md:block w-80 border-r">
          <SidebarContent />
        </div>

        {/* Mobile Sidebar */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-80 p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" className="md:hidden h-8 w-8 p-0">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                </Sheet>

                <div>
                  <h1 className="text-lg font-medium mb-1">Test Documents</h1>
                  <p className="text-sm text-muted-foreground">Manage documents in this collection</p>
                </div>
              </div>

              <Button className="w-full sm:w-auto">
                <MessageSquare className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Chat with your documents</span>
                <span className="sm:hidden">Chat</span>
              </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6">
              <Button
                variant={activeTab === "upload" ? "default" : "ghost"}
                onClick={() => setActiveTab("upload")}
                className="text-sm"
              >
                Upload File
              </Button>
              <Button
                variant={activeTab === "text" ? "default" : "ghost"}
                onClick={() => setActiveTab("text")}
                className="text-sm"
              >
                Add Text
              </Button>
            </div>

            {/* Content Area */}
            <div className="rounded-lg border p-4 md:p-6 mb-6">
              {activeTab === "upload" ? (
                <div className="border-2 border-dashed rounded-lg p-8 md:p-12 text-center">
                  <Upload className="h-8 w-8 md:h-12 md:w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">Drag and drop files here or click to browse</p>
                  <Button variant="outline" className="text-sm">
                    Select Files
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Textarea
                    placeholder="Paste or type your text here..."
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    className="min-h-[150px] md:min-h-[200px] resize-none text-sm"
                  />
                  <Button className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Text Document
                  </Button>
                </div>
              )}
            </div>

            {/* Documents Table - Desktop */}
            <div className="hidden md:block rounded-lg border overflow-hidden">
              <div className="grid grid-cols-4 gap-4 p-4 bg-muted border-b text-sm font-medium">
                <div>Document Name</div>
                <div>Collection</div>
                <div>Date Uploaded</div>
                <div>Actions</div>
              </div>

              {documents.length > 0 ? (
                documents.map((doc, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-4 gap-4 p-4 border-b last:border-b-0 hover:bg-muted/50"
                  >
                    <div className="text-sm truncate">{doc.name}</div>
                    <div className="text-sm text-muted-foreground">{doc.collection}</div>
                    <div className="text-sm text-muted-foreground">{doc.dateUploaded}</div>
                    <div>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">No documents found</p>
                </div>
              )}
            </div>

            {/* Documents Cards - Mobile */}
            <div className="md:hidden space-y-4">
              {documents.length > 0 ? (
                documents.map((doc, index) => (
                  <div key={index} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-sm font-medium line-clamp-2 flex-1 mr-2">{doc.name}</h3>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Collection:</span>
                        <span>{doc.collection}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Date Uploaded:</span>
                        <span>{doc.dateUploaded}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">No documents found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Collection Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Create New Collection</DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">Enter a name for your new collection.</p>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Name</label>
              <Input
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                className="w-full text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                value={newCollectionDescription}
                onChange={(e) => setNewCollectionDescription(e.target.value)}
                className="w-full min-h-[80px] md:min-h-[100px] resize-none text-sm"
              />
              <div className="text-xs text-muted-foreground mt-1 text-right">
                {newCollectionDescription.length}/850 characters
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={handleCreateCollection}
                className="w-full sm:w-auto"
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}