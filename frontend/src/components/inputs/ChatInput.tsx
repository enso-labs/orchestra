import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { MainToolTip } from "../tooltips/MainToolTip"
import { ImagePreview } from "./ImagePreview"
import { ImagePreviewModal } from "./ImagePreviewModal"
import { useChatContext } from "@/context/ChatContext"
import { useRef, useEffect, useState } from "react"
import useAppHook from "@/hooks/useAppHook"
import { AudioRecorder } from "./AudioRecorder"
import ChatSubmitButton from "../buttons/ChatSubmitButton"
import ConfigDrawer from "../drawers/ConfigDrawer"
import { useVoiceVisualizer, VoiceVisualizer } from "react-voice-visualizer"
import MenuAgents from "../menu/MenuAgents/menu-agents"
import { useAgentContext } from "@/context/AgentContext"

export default function ChatInput() {
  const { agents } = useAgentContext();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const { 
    query, 
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
    setPreviewImage,
    handleSubmit,
  } = useChatContext();
  
  const { isMobile } = useAppHook();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Initialize the recorder controls using the hook
  const recorderControls = useVoiceVisualizer();

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
      
      {/* Voice Visualizer - only show when recording */}
      {isRecording && (
        <div className="px-4 py-2 bg-background border border-input rounded-t-2xl border-b-0">
          <VoiceVisualizer 
            controls={recorderControls} 
            height={35}
            width="100%"
            isControlPanelShown={false}
            isDefaultUIShown={false}
            onlyRecording={true}
            speed={1}
            barWidth={2}
          />
        </div>
      )}
      
      <textarea
        ref={textareaRef}
        className={`w-full resize-none overflow-y-auto min-h-[48px] max-h-[200px] p-4 pr-14 bg-background border border-input ${isRecording ? 'rounded-none' : 'rounded-t-2xl'} focus:outline-none border-b-0`}
        placeholder="How can I help you be present?"
        rows={1}
        value={query}
        onChange={handleTextareaResize}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !isRecording && query.length > 0) {
            e.preventDefault()
            handleSubmit()
          }
        }}
      />
      <div className="flex justify-between items-center bg-background border border-input rounded-b-2xl border-t-0">
        <div className="flex items-center gap-2 mb-1 px-1 flex-1">
          {/* Agent Selector - positioned at bottom left */}
         {agents.length > 0 && (
          <div className="w-48">
            <MenuAgents />
          </div>
         )}
          
          <div className="flex gap-1">
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
            <ConfigDrawer />
          </div>
        </div>
        <div className="flex items-center gap-2 mr-2">
          <AudioRecorder 
            onRecordingChange={setIsRecording} 
            recorderControls={recorderControls}
          />
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

