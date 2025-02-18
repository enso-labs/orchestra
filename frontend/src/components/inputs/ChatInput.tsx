import type React from "react"

import { useChatContext } from "@/context/ChatContext"
import { Button } from "@/components/ui/button"
import { ArrowUp, Plus } from "lucide-react"
import { ToolSelector } from "../selectors/ToolSelector"
import { MainToolTip } from "../tooltips/MainToolTip"
import { ImagePreview } from "./ImagePreview"
import { ImagePreviewModal } from "./ImagePreviewModal"
import { useCallback, useState } from "react"
import { toast } from "sonner"

const MAX_IMAGES = 10
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB

export default function ChatInput() {
  const { payload, handleQuery, setPayload } = useChatContext()
  const [images, setImages] = useState<File[]>([])
  const [previewImage, setPreviewImage] = useState<File | null>(null)
  const [previewImageIndex, setPreviewImageIndex] = useState<number>(0)

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })
  }

  const addImages = useCallback(async (files: File[]) => {
    if (!files.length) return

    // Filter for only images and check file size
    const validImages = files.filter((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image file`)
        return false
      }
      if (file.size > MAX_IMAGE_SIZE) {
        toast.error(`${file.name} is too large (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`)
        return false
      }
      return true
    })

    setImages((currentImages) => {
      const newImages = [...currentImages]
      validImages.some((file) => {
        if (newImages.length >= MAX_IMAGES) {
          toast.error(`Maximum ${MAX_IMAGES} images allowed`)
          return true
        }
        // Check for duplicates by name and size
        if (!newImages.some((existing) => existing.name === file.name && existing.size === file.size)) {
          newImages.push(file)
        }
        return false
      })
      return newImages
    })

    // Convert new valid images to base64 and update payload
    const base64Promises = validImages.map(convertToBase64)
    const base64Images = await Promise.all(base64Promises)
    
    setPayload((prev: any) => ({
      ...prev,
      images: [...prev.images, ...base64Images]
    }))
  }, [setPayload])

  const handleTextareaResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    setPayload({ ...payload, query: e.target.value })
  }

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const imageFiles: File[] = []
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) imageFiles.push(file)
        }
      }
      addImages(imageFiles)
    },
    [addImages],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const items = Array.from(e.dataTransfer?.files || [])
      addImages(items)
    },
    [addImages],
  )

  const removeImage = useCallback((index: number) => {
    setImages((currentImages) => currentImages.filter((_, i) => i !== index))
    setPayload((prev: any) => ({
      ...prev,
      images: prev.images.filter((_: any, i: number) => i !== index)
    }))
  }, [setPayload])

  const handleSubmit = useCallback(() => {
    handleQuery()
    // Clear images after sending
    setImages([])
    setPayload((prev: any) => ({
      ...prev,
      images: []
    }))
  }, [handleQuery, setPayload])

  const handleImageClick = useCallback((image: File, index: number) => {
    setPreviewImage(image)
    setPreviewImageIndex(index)
  }, [])

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

