import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SiAnthropic, SiOpenai, SiOllama, SiGoogle, SiPayloadcms } from 'react-icons/si';
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
//   onAssistantClick: () => void;
}

export function ChatNav({ 
    onMenuClick, 
    // onAssistantClick 
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
                {/* <button 
                    onClick={() => navigate('/dashboard')}
                    className="hidden md:inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mr-4"
                >
                    <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-5 w-5 mr-1" 
                    viewBox="0 0 20 20" 
                    fill="currentColor"
                    >
                    <path 
                        fillRule="evenodd" 
                        d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" 
                        clipRule="evenodd" 
                    />
                    </svg>
                </button> */}
                {/* <h1 className="text-2xl font-bold text-foreground">Chat</h1> */}
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
                        onClick={handleNewChat}
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