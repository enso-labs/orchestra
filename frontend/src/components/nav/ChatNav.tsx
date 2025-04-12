import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SiAnthropic, SiOpenai, SiOllama, SiGoogle } from 'react-icons/si';
import { FaPlus } from 'react-icons/fa';
import { Button } from "@/components/ui/button";
import { ColorModeButton } from '@/components/buttons/ColorModeButton';
import { useSearchParams } from "react-router-dom";
import { useChatContext } from "@/context/ChatContext";
import { Model } from "@/services/modelService";
import { Menu } from "lucide-react";
import GroqIcon from "../icons/GroqIcon";
import { useEffect } from "react";

interface ChatNavProps {
  onMenuClick: () => void;
  onNewChat?: () => void;
}

export function ChatNav({ 
    onMenuClick, 
    onNewChat 
}: ChatNavProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const currentModel = searchParams.get('model') || '';
    
    const { 
        models,
        handleNewChat,
        payload
    } = useChatContext();

    const handleModelChange = (modelId: string) => {
        setSearchParams({ model: modelId });
    }

    useEffect(() => {
        setSearchParams({ model: payload.model });
    }, [payload.model]);

    return (
        <header className="bg-card border-b border-border">
            <div className="mx-auto px-4 sm:px-6 lg:px-4 py-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <button 
                        onClick={onMenuClick}
                        className="inline-flex md:hidden items-center text-muted-foreground hover:text-foreground transition-colors mr-4"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                </div>
                
                <div className="flex items-center gap-2">
                    <Select value={currentModel} onValueChange={handleModelChange}>
                        <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select Model" />
                        </SelectTrigger>
                        <SelectContent>
                            {models
                                .sort((a: Model, b: Model) => a.id.localeCompare(b.id))
                                .filter((model: Model) => !model.metadata.embedding)
                                .map((model: Model) => (
                                <SelectItem key={model.id} value={model.id}>
                                    <div className="flex items-center gap-2">
                                    {model.provider === 'openai' && (
                                        <SiOpenai className="h-4 w-4" />
                                    )}
                                    {model.provider === 'anthropic' && (
                                        <SiAnthropic className="h-4 w-4" />
                                    )}
                                    {model.provider === 'ollama' && (
                                        <SiOllama className="h-4 w-4" />
                                    )}
                                    {model.provider === 'groq' && (
                                        <GroqIcon />
                                    )}
                                    {model.provider === 'google' && (
                                        <SiGoogle className="h-4 w-4" />
                                    )}
                                    {model.label}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onNewChat || handleNewChat}
                        className="h-9 w-9"
                        title="New Chat"
                    >
                        <FaPlus className="h-4 w-4" />
                    </Button>
                    <ColorModeButton />
                </div>
            </div>
            </div>
        </header>
    )
}