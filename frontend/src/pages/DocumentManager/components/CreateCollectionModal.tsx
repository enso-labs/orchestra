import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface CreateCollectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  newCollectionName: string
  onNewCollectionNameChange: (name: string) => void
  newCollectionDescription: string
  onNewCollectionDescriptionChange: (description: string) => void
  onCreateCollection: () => void
}

export function CreateCollectionModal({
  open,
  onOpenChange,
  newCollectionName,
  onNewCollectionNameChange,
  newCollectionDescription,
  onNewCollectionDescriptionChange,
  onCreateCollection,
}: CreateCollectionModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onChange={(e) => onNewCollectionNameChange(e.target.value)}
              className="w-full text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Description</label>
            <Textarea
              value={newCollectionDescription}
              onChange={(e) => onNewCollectionDescriptionChange(e.target.value)}
              className="w-full min-h-[80px] md:min-h-[100px] resize-none text-sm"
            />
            <div className="text-xs text-muted-foreground mt-1 text-right">
              {newCollectionDescription.length}/850 characters
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={onCreateCollection}
              className="w-full sm:w-auto"
            >
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 