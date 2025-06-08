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
import { getCollections, deleteCollection, createCollection, getDocuments, deleteDocument } from "@/services/ragService"
import { Collection } from "./types"
import { EmptyState } from "./components/EmptyState"
import { Menu, Loader2 } from "lucide-react"
import { useParams, useNavigate } from "react-router-dom"

export default function DocumentManager() {
  const navigate = useNavigate();
  const { collectionId } = useParams();
  const [activeTab, setActiveTab] = useState("upload")
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState("")
  const [newCollectionDescription, setNewCollectionDescription] = useState("")
  const [textContent, setTextContent] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<string>("")
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  const handleCollectionSelect = (collectionUuid: string) => {
    setSelectedCollection(collectionUuid);
    navigate(`/collections/${collectionUuid}`);
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) {
      alert('Please enter a collection name');
      return;
    }

    try {
      // Create the collection object
      const newCollection: Omit<Collection, 'uuid'> = {
        name: newCollectionName.trim(),
        metadata: {
          description: newCollectionDescription.trim()
        }
      };

      // Call the API to create the collection
      const createdCollection = await createCollection(newCollection as Collection);
      
      // Refresh the collections list
      const updatedCollections = await getCollections();
      setCollections(updatedCollections);
      
      // Navigate to the newly created collection
      if (createdCollection && createdCollection.uuid) {
        navigate(`/collections/${createdCollection.uuid}`);
      } else if (updatedCollections.length > 0) {
        // Fallback: navigate to the last collection (likely the newly created one)
        const lastCollection = updatedCollections[updatedCollections.length - 1];
        navigate(`/collections/${lastCollection.uuid}`);
      }
      
      // Close modal and reset form
      setShowCreateModal(false);
      setNewCollectionName("");
      setNewCollectionDescription("");
      
    } catch (error) {
      console.error('Error creating collection:', error);
      alert('Failed to create collection. Please try again.');
    }
  };

  const handleUploadComplete = async () => {
    if (selectedCollection) {
      await fetchDocuments(selectedCollection);
    }
  };

  const fetchDocuments = async (collectionId: string) => {
    try {
      setLoadingDocuments(true);
      const docs = await getDocuments(collectionId);
      setDocuments(docs);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  // const handleFileSelect = () => {
  //   // TODO: Implement file selection logic
  // }

  const handleTextSubmit = () => {
    // TODO: Implement text submission logic
  }

  const handleEditCollection = () => {
    // TODO: Implement edit collection logic
    console.log('Edit collection:', selectedCollection)
  }

  const handleDeleteCollection = async () => {
    if (!selectedCollection) return
    
    const selectedCollectionName = Array.isArray(collections) ? 
      collections.find((collection: Collection) => collection.uuid === selectedCollection)?.name || 'this collection' :
      'this collection'
    
    if (window.confirm(`Are you sure you want to delete "${selectedCollectionName}"? This action cannot be undone and will permanently remove all documents in this collection.`)) {
      try {
        await deleteCollection(selectedCollection)
        // Refresh collections after deletion
        const updatedCollections = await getCollections()
        setCollections(updatedCollections)
        
        // Navigate appropriately after deletion
        if (updatedCollections.length > 0) {
          navigate(`/collections/${updatedCollections[0].uuid}`)
        } else {
          navigate('/collections')
        }
      } catch (error) {
        console.error('Error deleting collection:', error)
        alert('Failed to delete collection. Please try again.')
      }
    }
  }

  const handleDeleteDocument = async (collectionId: string, documentId: string) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDocument(collectionId, documentId);
      // Refresh documents after deletion
      await fetchDocuments(selectedCollection);
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document. Please try again.');
    }
  };

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const response = await getCollections();
        console.log(response);
        const collectionsArray = Array.isArray(response) ? response : [];
        setCollections(collectionsArray);
        
        if (collectionsArray.length > 0) {
          if (collectionId) {
            // Check if the collection ID from URL exists
            const foundCollection = collectionsArray.find((c: Collection) => c.uuid === collectionId);
            if (foundCollection) {
              setSelectedCollection(collectionId);
            } else {
              // Collection not found, redirect to first collection
              navigate(`/collections/${collectionsArray[0].uuid}`, { replace: true });
            }
          } else {
            // No collection ID in URL, redirect to first collection
            navigate(`/collections/${collectionsArray[0].uuid}`, { replace: true });
          }
        } else {
          // No collections, navigate to /collections
          setSelectedCollection("");
          navigate('/collections', { replace: true });
        }
      } catch (error) {
        console.error('Error fetching collections:', error);
        setCollections([]);
      }
    }
    fetchCollections();
  }, [collectionId, navigate]);

  // Update selectedCollection when collectionId changes
  useEffect(() => {
    if (collectionId && collections.length > 0) {
      const foundCollection = collections.find(c => c.uuid === collectionId);
      if (foundCollection) {
        setSelectedCollection(collectionId);
      }
    }
  }, [collectionId, collections]);

  // Update useEffect to also fetch documents when collection changes
  useEffect(() => {
    if (selectedCollection) {
      fetchDocuments(selectedCollection);
    }
  }, [selectedCollection]);

  // If no collections, show empty state
  if (collections.length === 0) {
    return (
      <div className="min-h-screen">
        <div className="flex h-screen">
          {/* Desktop Sidebar */}
          <div className="hidden md:block w-80 border-r">
            <Sidebar
              collections={collections}
              selectedCollection={selectedCollection}
              onCollectionSelect={handleCollectionSelect}
              onCreateCollection={() => setShowCreateModal(true)}
            />
          </div>

          {/* Mobile Sidebar */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent side="left" className="w-80 p-0">
              <Sidebar
                collections={collections}
                selectedCollection={selectedCollection}
                onCollectionSelect={handleCollectionSelect}
                onCreateCollection={() => setShowCreateModal(true)}
              />
            </SheetContent>
          </Sheet>

          {/* Main Content - Empty State */}
          <div className="flex-1 p-4 md:p-6 overflow-auto">
            <div className="max-w-6xl mx-auto">
              {/* Mobile menu button for empty state */}
              <div className="md:hidden mb-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSidebarOpen(true)}
                  className="h-8 w-8 p-0"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </div>
              
              <EmptyState onCreateCollection={() => setShowCreateModal(true)} />
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

  return (
    <div className="min-h-screen">
      <div className="flex h-screen">
        {/* Desktop Sidebar */}
        <div className="hidden md:block w-80 border-r">
          <Sidebar
            collections={collections}
            selectedCollection={selectedCollection}
            onCollectionSelect={handleCollectionSelect}
            onCreateCollection={() => setShowCreateModal(true)}
          />
        </div>

        {/* Mobile Sidebar */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-80 p-0">
            <Sidebar
              collections={collections}
              selectedCollection={selectedCollection}
              onCollectionSelect={handleCollectionSelect}
              onCreateCollection={() => setShowCreateModal(true)}
            />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
            <Header
              title={Array.isArray(collections) ? collections.find((collection: Collection) => collection.uuid === selectedCollection)?.name ?? '' : ''}
              description="Manage documents in this collection"
              onMenuClick={() => setSidebarOpen(true)}
              onEditClick={handleEditCollection}
              onDeleteClick={handleDeleteCollection}
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
                <UploadSection 
                  collectionId={selectedCollection}
                  onUploadComplete={handleUploadComplete}
                />
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
              {loadingDocuments ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading documents...</p>
                </div>
              ) : (
                <DocumentTable 
                  collectionId={selectedCollection}
                  documents={documents} 
                  onDeleteDocument={handleDeleteDocument}
                />
              )}
            </div>

            {/* Documents Cards - Mobile */}
            <div className="md:hidden">
              {loadingDocuments ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading documents...</p>
                </div>
              ) : (
                <DocumentCards 
                  documents={documents} 
                  onDeleteDocument={handleDeleteDocument}
                />
              )}
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