import NoAuthLayout from '../layouts/NoAuthLayout';
import { ColorModeButton } from '@/components/buttons/ColorModeButton';
import ChatInput from '@/components/inputs/ChatInput';
import { useSearchParams, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useChatContext } from '@/context/ChatContext';

export default function Home() {
    const { setPayload } = useChatContext();
    const [searchParams, setSearchParams] = useSearchParams();
    const currentModel = searchParams.get('model') || '';
    const { 
        useFetchModelsEffect, 
        useSelectModelEffect,
    } = useChatContext();
    
    // Set default model in query params on component load if not already set
    useEffect(() => {
        if (!searchParams.get('model')) {
            setSearchParams({ model: 'openai-gpt-4o-mini' });
        }
    }, [searchParams, setSearchParams]);

    useFetchModelsEffect(setSearchParams, currentModel);
    useSelectModelEffect(currentModel);

    useEffect(() => {
        const a2a = localStorage.getItem('a2a');
        if (a2a) {
            setPayload((prev: any) => ({ ...prev, a2a: JSON.parse(a2a) }));
        }
    }, []);

    return (
        <NoAuthLayout>
            <main className="flex-1 flex flex-col items-center justify-center bg-background">
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
                <h1 className="text-4xl font-bold mt-2">Enso Labs</h1>
                <p className="text-lg mb-6">The AI-powered agent builder</p>
                <div className="flex flex-col w-full lg:w-[600px]">
                    <ChatInput />
                </div>
            </main>
        </NoAuthLayout>
    );
}
