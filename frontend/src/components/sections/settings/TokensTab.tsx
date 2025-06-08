import { useState, useEffect } from 'react';
import TokenCard from './TokenCard';
import { useTokens } from '../../../hooks/useTokens';

// Reference the enum values from backend/src/constants/__init__.py
const TOKEN_KEYS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GROQ_API_KEY',
  'GEMINI_API_KEY',
  'OLLAMA_BASE_URL',
  'SHELL_EXEC_SERVER_URL',
  'SEARX_SEARCH_HOST_URL',
  'ARCADE_API_KEY',
  'TAVILY_API_KEY'
] as const;

interface TokenEdit {
    value: string;
    showValue: boolean;
}

export default function TokensTab() {
    const { tokens, isLoading, updateToken, deleteToken, fetchTokens } = useTokens();
    const [editingTokens, setEditingTokens] = useState<Record<string, TokenEdit>>({});

    useEffect(() => {
        fetchTokens();
    }, [fetchTokens]);

    const handleTokenEdit = async (key: string) => {
        const tokenEdit = editingTokens[key];
        if (!tokenEdit?.value) return;

        try {
            await updateToken(key, tokenEdit.value);
            setEditingTokens(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        } catch (error) {
            console.error('Failed to update token:', error);
        }
    };

    const handleDeleteToken = async (key: string) => {
        try {
            await deleteToken(key);
        } catch (error) {
            console.error('Failed to delete token:', error);
        }
    };

    const startEditing = (key: string) => {
        setEditingTokens(prev => ({
            ...prev,
            [key]: { value: '', showValue: false }
        }));
    };

    const cancelEditing = (key: string) => {
        setEditingTokens(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const updateEditing = (key: string, updates: Partial<TokenEdit>) => {
        setEditingTokens(prev => ({
            ...prev,
            [key]: { ...prev[key], ...updates }
        }));
    };

    return (
        <div className="bg-card text-card-foreground rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-foreground mb-6">API Tokens</h1>
            
            <div className="space-y-4">
                {TOKEN_KEYS.map((key) => {
                    const token = tokens.find(t => t.key === key);
                    const isEditing = key in editingTokens;
                    const editToken = editingTokens[key];

                    return (
                        <TokenCard
                            key={key}
                            tokenKey={key}
                            token={token}
                            isEditing={isEditing}
                            editToken={editToken}
                            isLoading={isLoading}
                            onStartEditing={() => startEditing(key)}
                            onCancelEditing={() => cancelEditing(key)}
                            onUpdateEditing={(updates) => updateEditing(key, updates)}
                            onSave={() => handleTokenEdit(key)}
                            onDelete={() => handleDeleteToken(key)}
                        />
                    );
                })}
            </div>
        </div>
    );
} 