import { useState, useEffect } from 'react';
import AuthLayout from '../layouts/AuthLayout';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import apiClient from '../lib/utils/apiClient';

// Reference the enum values from backend/src/constants/__init__.py
const TOKEN_KEYS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GROQ_API_KEY',
  'GEMINI_API_KEY',
  'OLLAMA_BASE_URL',
  'SHELL_EXEC_SERVER_URL'
] as const;

// For displaying existing tokens
interface Token {
    key: string;
    is_set: boolean;
}

// For creating new tokens
interface TokenCreate {
    key: string;
    value: string;
}

export default function Settings() {
    const [tokens, setTokens] = useState<Token[]>([]);
    const [newToken, setNewToken] = useState<TokenCreate>({ key: '', value: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [showTokenValue, setShowTokenValue] = useState(false);

    // Fetch existing tokens on component mount
    useEffect(() => {
        fetchTokens();
    }, []);

    const fetchTokens = async () => {
        try {
            const response = await apiClient.get('/tokens');
            setTokens(response.data.tokens || []);
        } catch (error) {
            console.error('Failed to fetch tokens');
        }
    };

    const handleCreateToken = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            await apiClient.post('/tokens', newToken);
            console.log('Token created successfully');
            setNewToken({ key: '', value: '' });
            fetchTokens();
        } catch (error: any) {
            console.error(error.response?.data?.detail || 'Failed to create token');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteToken = async (key: string) => {
        try {
            await apiClient.delete(`/tokens/${key}`);
            console.log('Token deleted successfully');
            fetchTokens();
        } catch (error) {
            console.error('Failed to delete token');
        }
    };

    return (
        <AuthLayout>
            <main className="max-w-4xl mx-auto p-6">
                <div className="bg-card text-card-foreground rounded-lg shadow-md p-6">
                    <h1 className="text-2xl font-bold text-foreground mb-6">API Tokens</h1>
                    
                    {/* Add New Token Form */}
                    <form onSubmit={handleCreateToken} className="mb-8 space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Token Type
                                </label>
                                <select
                                    value={newToken.key}
                                    onChange={(e) => setNewToken({ ...newToken, key: e.target.value })}
                                    className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                                    required
                                >
                                    <option value="">Select token type</option>
                                    {TOKEN_KEYS.map((key) => (
                                        <option key={key} value={key}>{key}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Token Value
                                </label>
                                <div className="relative">
                                    <input
                                        type={showTokenValue ? "text" : "password"}
                                        value={newToken.value}
                                        onChange={(e) => setNewToken({ ...newToken, value: e.target.value })}
                                        className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent pr-10"
                                        placeholder="Enter token value"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowTokenValue(!showTokenValue)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showTokenValue ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-end">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Token
                                </button>
                            </div>
                        </div>
                    </form>

                    {/* Existing Tokens */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-foreground">Existing Tokens</h2>
                        {tokens.length === 0 ? (
                            <p className="text-muted-foreground">No tokens added yet.</p>
                        ) : (
                            <div className="grid gap-4">
                                {tokens.map((token) => (
                                    <div
                                        key={token.key}
                                        className="flex items-center justify-between p-4 bg-background rounded-lg border border-border"
                                    >
                                        <div>
                                            <h3 className="font-medium text-foreground">{token.key}</h3>
                                            <p className="text-sm text-muted-foreground">
                                                {token.is_set ? "Token Set" : "Not Set"}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteToken(token.key)}
                                            className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                            aria-label="Delete token"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </AuthLayout>
    );
} 