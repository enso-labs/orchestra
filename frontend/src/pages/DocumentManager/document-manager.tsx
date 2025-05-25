
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
        <h2 className="text-lg font-semibold text-gray-900">Collections</h2>
        <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(true)} className="h-8 w-8 p-0">
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <DropdownMenu open={showCollectionMenu} onOpenChange={setShowCollectionMenu}>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer group">
                <span className="text-gray-700">Test</span>
                <MoreHorizontal className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32">
              <DropdownMenuItem className="flex items-center gap-2">
                <Edit className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2 text-red-600">
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
    <div className="min-h-screen bg-gray-50">

      <div className="flex h-[calc(100vh-60px)]">
        {/* Desktop Sidebar */}
        <div className="hidden md:block w-80 bg-white border-r border-gray-200">
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
                {/* Mobile Menu Button */}
                <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" className="md:hidden h-8 w-8 p-0">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                </Sheet>

                <div>
                  <h1 className="text-xl md:text-2xl font-semibold text-gray-900 mb-1">Test Documents</h1>
                  <p className="text-sm md:text-base text-gray-600">Manage documents in this collection</p>
                </div>
              </div>

              <Button className="bg-teal-600 hover:bg-teal-700 text-white text-sm md:text-base w-full sm:w-auto">
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
                className={`text-sm md:text-base ${activeTab === "upload" ? "bg-gray-100 text-gray-900 hover:bg-gray-200" : ""}`}
              >
                Upload File
              </Button>
              <Button
                variant={activeTab === "text" ? "default" : "ghost"}
                onClick={() => setActiveTab("text")}
                className={`text-sm md:text-base ${activeTab === "text" ? "bg-gray-100 text-gray-900 hover:bg-gray-200" : ""}`}
              >
                Add Text
              </Button>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 mb-6">
              {activeTab === "upload" ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 md:p-12 text-center">
                  <Upload className="h-8 w-8 md:h-12 md:w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm md:text-base text-gray-600 mb-4">Drag and drop files here or click to browse</p>
                  <Button variant="outline" className="text-sm md:text-base">
                    Select Files
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Textarea
                    placeholder="Paste or type your text here..."
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    className="min-h-[150px] md:min-h-[200px] resize-none border-gray-300 text-sm md:text-base"
                  />
                  <Button className="bg-teal-600 hover:bg-teal-700 text-white text-sm md:text-base w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Text Document
                  </Button>
                </div>
              )}
            </div>

            {/* Documents Table - Desktop */}
            <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">
                <div>Document Name</div>
                <div>Collection</div>
                <div>Date Uploaded</div>
                <div>Actions</div>
              </div>

              {documents.map((doc, index) => (
                <div
                  key={index}
                  className="grid grid-cols-4 gap-4 p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                >
                  <div className="text-sm text-gray-900 truncate">{doc.name}</div>
                  <div className="text-sm text-gray-600">{doc.collection}</div>
                  <div className="text-sm text-gray-600">{doc.dateUploaded}</div>
                  <div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Documents Cards - Mobile */}
            <div className="md:hidden space-y-4">
              {documents.map((doc, index) => (
                <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1 mr-2">{doc.name}</h3>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2 text-xs text-gray-600">
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
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Create Collection Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md mx-4 w-[calc(100vw-2rem)] sm:w-full">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg md:text-xl">Create New Collection</DialogTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-gray-600 mt-2">Enter a name for your new collection.</p>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Name</label>
              <Input
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder=""
                className="w-full text-sm md:text-base"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Description</label>
              <Textarea
                value={newCollectionDescription}
                onChange={(e) => setNewCollectionDescription(e.target.value)}
                className="w-full min-h-[80px] md:min-h-[100px] resize-none text-sm md:text-base"
                placeholder=""
              />
              <div className="text-xs text-gray-500 mt-1 text-right">
                {newCollectionDescription.length}/850 characters
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={handleCreateCollection}
                className="bg-teal-600 hover:bg-teal-700 text-white text-sm md:text-base w-full sm:w-auto"
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