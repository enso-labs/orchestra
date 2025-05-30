import NoAuthLayout from '../layouts/NoAuthLayout';
import { ColorModeButton } from '@/components/buttons/ColorModeButton';
import ChatInput from '@/components/inputs/ChatInput';
import { Link, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useChatContext } from '@/context/ChatContext';
import { DEFAULT_CHAT_MODEL } from '@/config/llm';
import HomeSection from '@/components/sections/home';

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
                <HomeSection />
            </main>
        </NoAuthLayout>
    );
}
