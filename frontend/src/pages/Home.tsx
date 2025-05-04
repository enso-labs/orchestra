import NoAuthLayout from '../layouts/NoAuthLayout';
import { ColorModeButton } from '@/components/buttons/ColorModeButton';
import ChatInput from '@/components/inputs/ChatInput';
import { Link, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useChatContext } from '@/context/ChatContext';
import { DEFAULT_CHAT_MODEL } from '@/config/llm';
import TabsBase from '@/components/tabs/TabsBase';
import AccordionBase from '@/components/accordion/AccordionBase';
import ListMcpServers from '@/components/lists/ListMcpServers.tsx';
import AccordionZero from '@/components/accordion/AccordionZero';

export default function Home() {
    const { setPayload, useSelectModelEffect, useFetchModelsEffect } = useChatContext();
    const [searchParams, setSearchParams] = useSearchParams();

    const currentModel = searchParams.get('model') || DEFAULT_CHAT_MODEL;

    useEffect(() => {
        const a2a = localStorage.getItem('a2a');
        if (a2a) {
            setPayload((prev: any) => ({ ...prev, a2a: JSON.parse(a2a) }));
        }
    }, []);

    
    useSelectModelEffect(currentModel);
    useFetchModelsEffect(setSearchParams, currentModel);

    return (
        <NoAuthLayout>
            <main className="flex-1 flex flex-col items-center justify-center bg-background p-6">
                <div className="absolute top-4 left-4">
                    <Link 
                        to="/login" 
                        className="text-muted-foreground hover:text-primary transition-colors duration-200 text-sm font-medium"
                    >
                        Login
                    </Link>
                </div>
                <div className="absolute top-4 right-4">
                    <ColorModeButton />
                </div>
                <img 
                    src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4" 
                    alt="Logo" 
                    className="w-32 h-32 mx-auto rounded-full" 
                />
                <h1 className="text-4xl font-bold mt-2">Ensō Cloud</h1>
                <p className="text-lg mb-2">Powered by <a href="https://github.com/enso-labs/mcp-sse" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">MCP</a> & <a href="https://github.com/enso-labs/a2a-langgraph" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">A2A</a></p>
                <div className="flex flex-row gap-2 mb-2">
                    <a href="https://discord.com/invite/QRfjg4YNzU"><img src="https://img.shields.io/badge/Join-Discord-purple" /></a>
                    <a href="https://enso.sh/socials"><img src="https://img.shields.io/badge/Follow-Social-black" /></a>
                    <a href="https://demo.enso.sh/docs/"><img src="https://img.shields.io/badge/View-Docs-blue" /></a>
                </div>
                <div className="flex flex-col w-full lg:w-[600px]">
                    <ChatInput />
                </div>
                <div className="flex flex-col w-full lg:w-[600px] mt-2">
                    {/* <TabsBase 
                        tabs={[
                            {
                                label: "MCP",
                                content: <ListMcpServers />
                            }, 
                            {
                                label: "A2A",
                                content: <div className="w-full h-full bg-secondary rounded-lg h-[100px] p-2">A2A</div>
                            }
                        ]} 
                    /> */}
                    <AccordionZero 
                        items={[
                            {
                                title: "Model Context Protocol (MCP)",
                                content: <ListMcpServers />
                            },
                            {
                                title: "Agent to Agent (A2A)",
                                content: <div className="w-full h-full bg-secondary rounded-lg h-[100px] p-2">A2A</div>
                            }
                        ]} 
                    />
                </div>
                
            </main>
        </NoAuthLayout>
    );
}
