import ChatLayout from '../layouts/ChatLayout';
import { useChatContext } from '../context/ChatContext';
import MarkdownCard from '../components/cards/MarkdownCard';
import { Button } from '@/components/ui/button';
import { ThreadHistoryDrawer } from '@/components/drawers/ThreadHistoryDrawer';
import { useEffect, useRef, useState } from 'react';
import {ChatNav} from '@/components/nav/ChatNav';
import SystemMessageCard from '@/components/cards/SystemMessageCard';
import { ChatDrawer } from '@/components/drawers/ChatDrawer';
import { Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
    role: string;
    content: string;
    type: string;
    name?: string;
    status?: string;
    tool_calls?: any[];
}

export default function Chat() {
    const { 
        messages, 
        payload, 
        handleQuery, 
        setPayload, 
        useGetHistoryEffect,
        isToolCallInProgress,
        setIsToolCallInProgress,
        currentToolCall,
        setCurrentToolCall 
    } = useChatContext();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [selectedToolMessage, setSelectedToolMessage] = useState<any>(null);

    const [, setCurrentThreadId] = useState<string | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]); // Scroll when messages change

    useEffect(() => {
        if (isToolCallInProgress && currentToolCall) {
            setSelectedToolMessage(currentToolCall);
            setIsAssistantOpen(true);
        }
    }, [isToolCallInProgress, currentToolCall]);

    useGetHistoryEffect();

    const handleDrawerClose = () => {
        setIsAssistantOpen(false);
        setSelectedToolMessage(null);
        setIsToolCallInProgress(false);
        setCurrentToolCall(null);
    };

    

    const prevThreadIdRef = useRef();

    useEffect(() => {
        // Only perform the check if we have a previous value
        if (prevThreadIdRef.current !== undefined) {
            if (payload.threadId && payload.threadId !== prevThreadIdRef.current) {
                handleDrawerClose();
            }
        }
    
        // Update the ref and state
        prevThreadIdRef.current = payload.threadId;
        setCurrentThreadId(payload.threadId || null);
    }, [payload.threadId]);

    return (
        <ChatLayout>
            <div className={`
                flex min-h-[calc(100vh-0px)] max-h-[calc(100vh-0px)] relative
                transition-[padding-right] duration-200 ease-in-out
                ${isAssistantOpen ? 'pr-[320px]' : ''}
            `}>
                <ThreadHistoryDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
                
                <div className="flex-1 flex flex-col overflow-hidden">
                    <ChatNav 
                        onMenuClick={() => setIsDrawerOpen(!isDrawerOpen)}
                        // onAssistantClick={() => setIsAssistantOpen(!isAssistantOpen)} 
                    />
                    <div className="flex-1 overflow-y-auto p-3 min-h-0">
                        <div className="space-y-4 max-w-4xl mx-auto pb-4">
                            {!messages.find((message: ChatMessage) => message.type === 'system') && <SystemMessageCard content={payload.system} />}
                            {messages?.map((message: ChatMessage, index: number) => {
                                if (message.type === 'tool') {
                                    return (
                                        <div key={index} className="flex justify-start">
                                            <div className="max-w-[90%] md:max-w-[80%] bg-transparent text-foreground-500 p-3 rounded-lg rounded-bl-sm">
                                                <div className="flex items-center">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedToolMessage(message);
                                                            setIsAssistantOpen(true);
                                                        }}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <Wrench className="h-4 w-4" />
                                                        {message.name}
                                                        <span className={cn(
                                                            "text-xs px-2 py-0.5 rounded-full",
                                                            message.status === 'success' ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                                                        )}>
                                                            {message.status}
                                                        </span>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                } else if (message.role === 'user' || message.role === 'human' || message.type === 'human') {
                                    return (
                                        <div key={index} className="flex justify-end">
                                            <div className="max-w-[80%] md:max-w-[70%] bg-primary/90 text-primary-foreground p-3 rounded-lg rounded-br-sm">
                                                <MarkdownCard content={message.content} />
                                            </div>
                                        </div>
                                    );
                                } else if (message.role === 'system' || message.type === 'system') {
                                    return <SystemMessageCard key={index} content={message.content} />;
                                } else if (
                                    message.role === 'assistant' || 
                                    message.type === 'assistant' || 
                                    message.role === 'ai' || 
                                    message.type === 'ai' &&
                                    message.tool_calls &&
                                    !(message.tool_calls.length > 0)
                                ) {
                                    return (
                                        <div key={index} className="flex justify-start">
                                            <div className="max-w-[90%] md:max-w-[80%] bg-transparent text-foreground-500 p-3 rounded-lg rounded-bl-sm">
                                                <MarkdownCard content={message.content} />
                                            </div>
                                        </div>
                                    );
                                }
                            })}
                            <div ref={messagesEndRef} /> {/* Invisible element to scroll to */}
                        </div>
                    </div>

                    <div className="sticky bottom-0 bg-background border-t border-border">
                        <div className="flex gap-3 p-3">
                            <textarea 
                                className="flex-1 resize-none min-h-[44px] max-h-[200px] p-3 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                                placeholder="Type your message here..."
                                rows={1}
                                value={payload.query}
                                onChange={(e) => setPayload({ ...payload, query: e.target.value })}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleQuery();
                                    }
                                }}
                            />
                            <Button onClick={handleQuery} disabled={payload.query.trim() === ''}>
                                Send
                            </Button>
                        </div>
                    </div>
                </div>

                <ChatDrawer 
                    isOpen={isAssistantOpen} 
                    onClose={handleDrawerClose}
                >
                    {selectedToolMessage ? (
                        <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Wrench className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-medium">{selectedToolMessage.name}</h3>
                                    <p className="text-sm text-muted-foreground">Tool Execution Details</p>
                                </div>
                            </div>
                            
                            <div className="prose prose-sm dark:prose-invert">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">Status:</span>
                                        <span className={cn(
                                            "text-xs px-2 py-0.5 rounded-full",
                                            selectedToolMessage.status === 'success' ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                                        )}>
                                            {selectedToolMessage.status}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="font-semibold">Input:</span>
                                        <div className="max-w-[290px] max-h-[600px] mt-2 p-2 bg-muted rounded-lg overflow-x-auto">
                                            <MarkdownCard content={selectedToolMessage.content} />
                                        </div>
                                    </div>
                                    <div>
                                        <span className="font-semibold">Output:</span>
                                        <div className="max-w-[290px] max-h-[600px] mt-2 p-2 bg-muted rounded-lg overflow-x-auto">
                                            <MarkdownCard content={selectedToolMessage.output} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="text-primary">AI</span>
                                </div>
                                <div>
                                    <h3 className="font-medium">GPT-4</h3>
                                    <p className="text-sm text-muted-foreground">Our most capable model</p>
                                </div>
                            </div>
                            
                            <div className="prose prose-sm dark:prose-invert">
                                <p>The current model can:</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li>Analyze complex problems</li>
                                    <li>Generate creative content</li>
                                    <li>Handle detailed conversations</li>
                                    <li>Process and explain code</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </ChatDrawer>
            </div>
        </ChatLayout>
    );
} 