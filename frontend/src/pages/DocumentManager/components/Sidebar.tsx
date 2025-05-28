import { Button } from "@/components/ui/button"
import { FolderPlus } from "lucide-react"

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
        <h2 className="text-lg font-medium">Collections</h2>
        <Button variant="ghost" size="sm" onClick={onCreateCollection} className="h-8 w-8 p-0">
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {collections.map((collection) => (
          <div 
            key={collection.uuid} 
            className={`p-3 rounded-lg cursor-pointer hover:bg-muted ${
              selectedCollection === collection.name ? 'bg-muted' : ''
            }`}
            onClick={() => onCollectionSelect(collection.uuid)}
          >
            {collection.name}
          </div>
        ))}
      </div>
    </div>
  )
} 