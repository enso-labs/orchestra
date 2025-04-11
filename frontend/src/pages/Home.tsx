import NoAuthLayout from '../layouts/NoAuthLayout';
import { ColorModeButton } from '@/components/buttons/ColorModeButton';
import ChatInput from '@/components/inputs/ChatInput';
import { useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';

export default function Home() {
    const [searchParams, setSearchParams] = useSearchParams();
    
    // Set default model in query params on component load if not already set
    useEffect(() => {
        if (!searchParams.get('model')) {
            setSearchParams({ model: 'openai-gpt-4o-mini' });
        }
    }, [searchParams, setSearchParams]);

    return (
        <NoAuthLayout>
            <main className="flex-1 flex flex-col items-center justify-center bg-background">
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
                <ChatInput />
            </main>
        </NoAuthLayout>
    );
}
