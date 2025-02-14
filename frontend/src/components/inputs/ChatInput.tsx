import { useChatContext } from "@/context/ChatContext"
import { Button } from "@/components/ui/button"
import { FaArrowUp, FaPlus } from "react-icons/fa";
import { ToolSelector } from "../selectors/ToolSelector";

import { MainToolTip } from "../tooltips/MainToolTip";

export default function ChatInput() {
    const {
        payload,
        handleQuery,
        setPayload,
    } = useChatContext()


    const handleTextareaResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const textarea = e.target
        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = "auto"
        // Set new height based on scrollHeight, capped at 200px
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
        setPayload({ ...payload, query: e.target.value })
    }

    return (
        <div className="flex flex-col">
            <textarea
                className="w-full resize-none overflow-y-auto min-h-[48px] max-h-[200px] p-4 pr-14 bg-background border border-input rounded-t-2xl focus:outline-none border-b-0"
                placeholder="Message PromptGPT..."
                rows={1}
                value={payload.query}
                onChange={handleTextareaResize}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleQuery()
                    }
                }}
            />
            <div className="flex justify-between items-center bg-background border border-input rounded-b-2xl border-t-0">
                <div className="flex gap-1 mb-1">
                    {/* <Button
                        onClick={handleQuery}
                        size="sm"
                        variant="outline"
                        className="rounded-full ml-1 bg-foreground/10 text-foreground-500"
                    >
                        <FaGlobe /> Search
                    </Button> */}
                    <MainToolTip content="Upload File">
                        <Button
                            onClick={() => alert('Not implemented yet')}
                            size="icon"
                            variant="outline"
                            className="rounded-full ml-1 bg-foreground/10 text-foreground-500"
                        >
                            <FaPlus />
                        </Button>
                    </MainToolTip>
                    <ToolSelector />
                </div>
                <MainToolTip content="Send Message" delayDuration={500}>
                    <Button
                        onClick={handleQuery}
                        disabled={payload.query.trim() === ""}
                        size="icon"
                        className="w-8 h-8 rounded-full m-1"
                    >
                        <FaArrowUp />
                    </Button>
                </MainToolTip>
            </div>
        </div>
    );
}