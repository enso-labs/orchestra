import { Button } from "@/components/ui/button";
import { ColorModeButton } from '@/components/buttons/ColorModeButton';
import { Link } from "react-router-dom";
import { useChatContext } from "@/context/ChatContext";
import { Share } from "lucide-react";
export function ShareNav() {
    const { payload } = useChatContext();

    return (
        <header className="bg-card border-b border-border">
            <div className="mx-auto px-4 sm:px-6 lg:px-4 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                         <Link to="/" className="flex items-center gap-2">
														<img 
															src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4" 
															alt="Logo" 
															className="w-8 h-8 rounded-full" 
														/>
														<h1 className="text-2xl font-bold text-foreground">Ensō</h1>
												</Link>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        
                         <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                                const { threadId } = payload;
                                if (threadId) {
                                  const shareUrl = `${window.location.origin}/share/${threadId}`;
                                  navigator.clipboard.writeText(shareUrl)
                                    .then(() => {
                                      alert(`Copied:\n${shareUrl}`);
                                    })
                                    .catch(err => {
                                      console.error('Failed to copy URL: ', err);
                                    });
                                }
                            }}
                            className="h-9 w-9"
                            title="Share Thread"
                        >
                            <Share className="h-4 w-4" />
                        </Button>
                        <ColorModeButton />
                    </div>
                </div>
            </div>
        </header>
    )
}