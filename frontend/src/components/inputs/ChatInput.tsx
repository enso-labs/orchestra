import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { MainToolTip } from "../tooltips/MainToolTip"
import { ImagePreview } from "./ImagePreview"
import { ImagePreviewModal } from "./ImagePreviewModal"
import { useChatContext } from "@/context/ChatContext"
import { useCallback, useRef, useEffect } from "react"
import useAppHook from "@/hooks/useAppHook"
import { useLocation } from "react-router-dom"
import { useNavigate } from "react-router-dom"
import { AudioRecorder } from "./AudioRecorder"
import ChatSubmitButton from "../buttons/ChatSubmitButton"
import ConfigDrawer from "../drawers/ConfigDrawer"

export default function ChatInput() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { 
    payload, 
    handleQuery, 
    setPayload, 
    currentModel, 
    abortQuery,
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
  } = useChatContext();
  const { isMobile } = useAppHook();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
		handleQuery();
		// Clear images after sending
		setImages([]);
		setPayload((prev: any) => ({
			...prev,
      query: "",
			images: []
		}));
	}, [handleQuery, setPayload])

  const triggerFileInput = (e: React.MouseEvent) => {
    e.preventDefault();
    fileInputRef.current?.click();
  };
  
  const triggerCameraInput = (e: React.MouseEvent) => {
    e.preventDefault();
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  useEffect(() => {
    if (location.pathname === "/" && payload.threadId) {
      navigate(`/thread/${payload.threadId}`);
    }
  }, [payload.threadId]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  return (
    <div className="flex flex-col w-full">
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
        ref={textareaRef}
        className="w-full resize-none overflow-y-auto min-h-[48px] max-h-[200px] p-4 pr-14 bg-background border border-input rounded-t-2xl focus:outline-none border-b-0"
        placeholder="How can I help you be present?"
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
        <div className="flex gap-1 mb-1 px-1">
          {currentModel?.metadata?.multimodal && (
            <>
              {isMobile() ? (
                <MainToolTip content="Take Photo">
                  <>
                    <Button
                      size="icon"
                      variant="outline"
                      className="rounded-full ml-1 bg-foreground/10 text-foreground-500 cursor-pointer"
                      onClick={triggerCameraInput}
                    >
                      {/* <FaCamera className="h-4 w-4" /> */}
                      <Plus className="h-4 w-4" />
                    </Button>
                    <input
                        type="file"
                        className="hidden"
                        ref={cameraInputRef}
                        accept="image/*"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || [])
                          addImages(files)
                          e.target.value = "" // Reset input
                        }}
                      />
                  </>
                </MainToolTip>
              ) : (
                <MainToolTip content="Upload Files">
                  <Button
                    size="icon"
                    variant="outline"
                    className="rounded-full ml-1 bg-foreground/10 text-foreground-500 cursor-pointer"
                    onClick={triggerFileInput}
                  >
                    <input
                      type="file"
                      className="hidden"
                      ref={fileInputRef}
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
              )}
            </>
          )}
          {/* {getAuthToken() && (
            <PresetPopover />
          )}
          <SearchButton />
          {currentModel?.metadata?.tool_calling && (
            <ToolSelector />
          )}
          {currentModel?.metadata?.tool_calling && (
            <ModalMcp />
          )} */}
          <ConfigDrawer />
        </div>
        <div className="flex items-center gap-2 mr-2">
          <AudioRecorder />
          <ChatSubmitButton 
            abortQuery={abortQuery}
            handleSubmit={handleSubmit}
          />
        </div>
      </div>
      <ImagePreviewModal 
        image={previewImage} 
        onClose={() => setPreviewImage(null)} 
        index={previewImageIndex} 
      />
    </div>
  )
}

