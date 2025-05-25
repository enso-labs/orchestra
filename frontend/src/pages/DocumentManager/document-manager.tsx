import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { CreateCollectionModal } from "./components/CreateCollectionModal"
import { Sidebar } from "./components/Sidebar"
import { DocumentTable } from "./components/DocumentTable"
import { DocumentCards } from "./components/DocumentCards"
import { UploadSection } from "./components/UploadSection"
import { TextInputSection } from "./components/TextInputSection"
import { Header } from "./components/Header"
import { getCollections } from "@/services/ragService"

export default function DocumentManager() {
  const [activeTab, setActiveTab] = useState("upload")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState("")
  const [newCollectionDescription, setNewCollectionDescription] = useState("")
  const [textContent, setTextContent] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState("Test")

  const documents = [
    {
      name: "Enso Labs Q3 2025 Growth Strategy_ Developers, Monetization & Community.pdf",
      collection: "Test",
      dateUploaded: "05/20/2025 12:27 PM",
    },
    {
      name: "Product Roadmap 2025.pdf",
      collection: "Product",
      dateUploaded: "05/19/2025 10:15 AM",
    },
    {
      name: "User Research Findings.docx",
      collection: "Research",
      dateUploaded: "05/18/2025 03:45 PM",
    },
    {
      name: "Marketing Strategy Q2 2025.pptx",
      collection: "Marketing",
      dateUploaded: "05/17/2025 09:30 AM",
    }
  ]

  const collections = [
    { name: "Test", description: "Default test collection" },
    { name: "Product", description: "Product-related documents" },
    { name: "Research", description: "User research and analysis" },
    { name: "Marketing", description: "Marketing materials and strategies" }
  ]

  const filteredDocuments = documents.filter(doc => doc.collection === selectedCollection)

  const handleCreateCollection = () => {
    setShowCreateModal(false)
    setNewCollectionName("")
    setNewCollectionDescription("")
  }

  const handleFileSelect = () => {
    // TODO: Implement file selection logic
  }

  const handleTextSubmit = () => {
    // TODO: Implement text submission logic
  }

  useEffect(() => {
    const fetchCollections = async () => {
      const collections = await getCollections();
      console.log(collections);
    }
    fetchCollections();
  }, []);

  return (
    <div className="min-h-screen">
      <div className="flex h-screen">
        {/* Desktop Sidebar */}
        <div className="hidden md:block w-80 border-r">
          <Sidebar
            collections={collections}
            selectedCollection={selectedCollection}
            onCollectionSelect={setSelectedCollection}
            onCreateCollection={() => setShowCreateModal(true)}
          />
        </div>

        {/* Mobile Sidebar */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-80 p-0">
            <Sidebar
              collections={collections}
              selectedCollection={selectedCollection}
              onCollectionSelect={setSelectedCollection}
              onCreateCollection={() => setShowCreateModal(true)}
            />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
            <Header
              title="Test Documents"
              description="Manage documents in this collection"
              onMenuClick={() => setSidebarOpen(true)}
              showMobileMenu={true}
            />

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
                <UploadSection onFileSelect={handleFileSelect} />
              ) : (
                <TextInputSection
                  textContent={textContent}
                  onTextChange={setTextContent}
                  onSubmit={handleTextSubmit}
                />
              )}
            </div>

            {/* Documents Table - Desktop */}
            <div className="hidden md:block">
              <DocumentTable documents={filteredDocuments} />
            </div>

            {/* Documents Cards - Mobile */}
            <div className="md:hidden">
              <DocumentCards documents={filteredDocuments} />
            </div>
          </div>
        </div>
      </div>

      <CreateCollectionModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        newCollectionName={newCollectionName}
        onNewCollectionNameChange={setNewCollectionName}
        newCollectionDescription={newCollectionDescription}
        onNewCollectionDescriptionChange={setNewCollectionDescription}
        onCreateCollection={handleCreateCollection}
      />
    </div>
  )
}