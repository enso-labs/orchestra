import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NoAuthLayout from '../layouts/NoAuthLayout';
import { TOKEN_NAME, VITE_API_URL } from '../config';
import { ColorModeButton } from '@/components/buttons/ColorModeButton';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch(`${VITE_API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    password
                })
            });

            if (response.ok) {
                const data = await response.json();
                // Store JWT token in localStorage
                localStorage.setItem(TOKEN_NAME, data.access_token);
                navigate('/dashboard');
            } else {
                const errorData = await response.json();
                setError(errorData.detail || 'Invalid credentials');
            }
        } catch (err) {
            setError('Failed to connect to server');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <NoAuthLayout>
            <main className="mt-[25vh] flex flex-col items-center justify-center bg-background">
                <div className="absolute top-4 right-4">
                    <ColorModeButton />
                </div>
                
                <div className="w-full max-w-md space-y-8 p-8 bg-card rounded-lg shadow-md border border-border">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-foreground">Login</h1>
                        <p className="mt-2 text-sm text-muted-foreground">Sign in to your account</p>
                    </div>
                    
                    <form onSubmit={handleLogin} className="mt-8 space-y-6">
                        {error && (
                            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm text-center">
                                {error}
                            </div>
                        )}
                        
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-foreground">
                                    Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="mt-1 block w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    placeholder="Enter your email"
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                                    Password
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="mt-1 block w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    placeholder="Enter your password"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Signing in...' : 'Sign in'}
                        </button>

                        <div className="text-center">
                            <span className="text-sm text-muted-foreground">
                                Don't have an account?{' '}
                                <a
                                    href="/register"
                                    className="font-medium text-primary hover:text-primary/90 transition-colors"
                                >
                                    Register here
                                </a>
                            </span>
                        </div>
                    </form>
                </div>
                <div className="text-center flex justify-center gap-2 my-3">
                    <a href="/docs/" target="_blank" className="hover:opacity-80 transition-opacity">
                        <img src="https://img.shields.io/badge/View%20Documentation-Docs-blue" alt="Documentation" />
                    </a>
                    <a href="https://github.com/ryaneggz/langgraph-template" target="_blank" className="hover:opacity-80 transition-opacity">
                        <img src="https://img.shields.io/badge/Join%20our%20community-Github-black" alt="Github" />
                    </a>
                </div>
            </main>
        </NoAuthLayout>
    );
}
