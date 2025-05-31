import { Button } from "@/components/ui/button"
import { FolderPlus, FileText } from "lucide-react"
import { Link } from "react-router-dom"

interface Collection {
  uuid: string
  name: string
  metadata: {
    additionalProps: Record<string, any>
    owner_id: string
  }
}

interface SidebarProps {
  collections: Collection[]
  selectedCollection: string
  onCollectionSelect: (collection: string) => void
  onCreateCollection: () => void
}

export function Sidebar({
  collections,
  selectedCollection,
  onCollectionSelect,
  onCreateCollection,
}: SidebarProps) {
  return (
    <div className="p-4 md:p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <Link to="/" className="flex items-center gap-2">
                <img 
                  src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4" 
                  alt="Logo" 
                  className="w-8 h-8 rounded-full" 
                />
                <h1 className="text-2xl font-bold text-foreground">Ensō</h1>
              </Link>
        <Button variant="ghost" size="sm" onClick={onCreateCollection} className="h-8 w-8 p-0">
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>

      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-8">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">No collections yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {collections.map((collection) => (
            <div 
              key={collection.uuid} 
              className={`p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors ${
                selectedCollection === collection.uuid ? 'bg-muted' : ''
              }`}
              onClick={() => onCollectionSelect(collection.uuid)}
            >
              {collection.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 