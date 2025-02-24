import { Button } from "@/components/ui/button"
import { ArrowUp, Plus } from "lucide-react"
import { ToolSelector } from "../selectors/ToolSelector"
import { MainToolTip } from "../tooltips/MainToolTip"
import { ImagePreview } from "./ImagePreview"
import { ImagePreviewModal } from "./ImagePreviewModal"
import useImageHook from "@/hooks/useImageHook"
import { useChatContext } from "@/context/ChatContext"
import { useCallback } from "react"
import { PresetPopover } from "../popovers/PresetPopover"
export default function ChatInput() {
  const { payload, handleQuery, setPayload } = useChatContext();
  const {
    images,
    previewImage,
    previewImageIndex,
    removeImage,
    handleImageClick,
    handleTextareaResize,
    handlePaste,
    handleDrop,
    addImages,
    setImages,
    setPreviewImage,
  } = useImageHook();

  const handleSubmit = useCallback(() => {
		handleQuery()
		// Clear images after sending
		setImages([])
		setPayload((prev: any) => ({
			...prev,
			images: []
		}))
	}, [handleQuery, setPayload])

  return (
    <div className="flex flex-col">
      {images.length > 0 && (
        <div className="px-4 py-2">
          <ImagePreview 
            images={images} 
            onRemove={removeImage} 
            onImageClick={(image) => handleImageClick(image, previewImageIndex)} 
          />
        </div>
      )}
      <textarea
        className="w-full resize-none overflow-y-auto min-h-[48px] max-h-[200px] p-4 pr-14 bg-background border border-input rounded-t-2xl focus:outline-none border-b-0"
        placeholder="Message PromptGPT..."
        rows={1}
        value={payload.query}
        onChange={handleTextareaResize}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
          }
        }}
      />
      <div className="flex justify-between items-center bg-background border border-input rounded-b-2xl border-t-0">
        <div className="flex gap-1 mb-1">
          <MainToolTip content="Upload Files">
            <Button
              size="icon"
              variant="outline"
              className="rounded-full ml-1 bg-foreground/10 text-foreground-500 cursor-pointer"
            >
              <input
                type="file"
                className="hidden"
                multiple
                accept="image/*"
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  addImages(files)
                  e.target.value = "" // Reset input
                }}
              />
              <Plus className="h-4 w-4" />
            </Button>
          </MainToolTip>
          <PresetPopover />
          <ToolSelector />
          
        </div>
        <MainToolTip content="Send Message" delayDuration={500}>
          <Button
            onClick={handleSubmit}
            disabled={payload.query.trim() === "" && images.length === 0}
            size="icon"
            className="w-8 h-8 rounded-full m-1"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </MainToolTip>
      </div>
      <ImagePreviewModal 
        image={previewImage} 
        onClose={() => setPreviewImage(null)} 
        index={previewImageIndex} 
      />
    </div>
  )
}

