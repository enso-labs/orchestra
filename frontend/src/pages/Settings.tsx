import { useState, useEffect, FormEvent } from 'react';
import AuthLayout from '../layouts/AuthLayout';
import { Trash2, Eye, EyeOff } from 'lucide-react';
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

interface TokenEdit {
    value: string;
    showValue: boolean;
}

interface PasswordForm {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export default function Settings() {
    const [activeTab, setActiveTab] = useState('tokens');
    const [tokens, setTokens] = useState<Token[]>([]);
    const [editingTokens, setEditingTokens] = useState<Record<string, TokenEdit>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [passwordForm, setPasswordForm] = useState<PasswordForm>({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordError, setPasswordError] = useState<string>('');
    const [passwordSuccess, setPasswordSuccess] = useState<string>('');

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

    const handleTokenEdit = async (key: string) => {
        const tokenEdit = editingTokens[key];
        if (!tokenEdit?.value) return;

        setIsLoading(true);
        try {
            await apiClient.post('/tokens', { key, value: tokenEdit.value });
            console.log('Token updated successfully');
            // Clear the editing state for this token
            setEditingTokens(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
            fetchTokens();
        } catch (error: any) {
            console.error(error.response?.data?.detail || 'Failed to update token');
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

    const handlePasswordChange = async (e: FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }

        if (passwordForm.newPassword.length < 8) {
            setPasswordError('New password must be at least 8 characters');
            return;
        }

        try {
            await apiClient.post('/auth/change-password', {
                current_password: passwordForm.currentPassword,
                new_password: passwordForm.newPassword
            });
            setPasswordSuccess('Password updated successfully');
            setPasswordForm({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
        } catch (error: any) {
            setPasswordError(error.response?.data?.detail || 'Failed to update password');
        }
    };

    return (
        <AuthLayout>
            <main className="max-w-8xl mx-auto p-6">
                {/* Tabs */}
                <div className="border-b border-border mb-6">
                    <div className="flex space-x-8">
                        <button
                            onClick={() => setActiveTab('tokens')}
                            className={`pb-2 px-1 ${
                                activeTab === 'tokens'
                                    ? 'border-b-2 border-primary font-semibold text-foreground'
                                    : 'text-muted-foreground'
                            }`}
                        >
                            Tokens
                        </button>
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`pb-2 px-1 ${
                                activeTab === 'profile'
                                    ? 'border-b-2 border-primary font-semibold text-foreground'
                                    : 'text-muted-foreground'
                            }`}
                        >
                            Profile
                        </button>
                    </div>
                </div>

                {activeTab === 'tokens' && (
                    <div className="bg-card text-card-foreground rounded-lg shadow-md p-6">
                        <h1 className="text-2xl font-bold text-foreground mb-6">API Tokens</h1>
                        
                        {/* Token Cards */}
                        <div className="space-y-4">
                            {TOKEN_KEYS.map((key) => {
                                const token = tokens.find(t => t.key === key);
                                const isEditing = key in editingTokens;
                                const editToken = editingTokens[key];

                                return (
                                    <div
                                        key={key}
                                        className="flex items-center justify-between p-4 bg-background rounded-lg border border-border min-w-[80vw] lg:min-w-[60vw]"
                                    >
                                        <div className="flex-1">
                                            <h3 className="font-medium text-foreground">{key}</h3>
                                            {isEditing ? (
                                                <div className="mt-2 flex items-center gap-2">
                                                    <div className="relative flex-1">
                                                        <input
                                                            type={editToken.showValue ? "text" : "password"}
                                                            value={editToken.value}
                                                            onChange={(e) => setEditingTokens(prev => ({
                                                                ...prev,
                                                                [key]: { ...prev[key], value: e.target.value }
                                                            }))}
                                                            className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent pr-10"
                                                            placeholder="Enter token value"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingTokens(prev => ({
                                                                ...prev,
                                                                [key]: { ...prev[key], showValue: !prev[key].showValue }
                                                            }))}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                        >
                                                            {editToken.showValue ? (
                                                                <EyeOff className="h-4 w-4" />
                                                            ) : (
                                                                <Eye className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => handleTokenEdit(key)}
                                                        disabled={isLoading}
                                                        className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingTokens(prev => {
                                                            const next = { ...prev };
                                                            delete next[key];
                                                            return next;
                                                        })}
                                                        className="px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 mt-2">
                                                    <p className="text-sm text-muted-foreground">
                                                        {token?.is_set ? "Token Set" : "Not Set"}
                                                    </p>
                                                    <button
                                                        onClick={() => setEditingTokens(prev => ({
                                                            ...prev,
                                                            [key]: { value: '', showValue: false }
                                                        }))}
                                                        className="text-sm text-primary hover:underline"
                                                    >
                                                        {token?.is_set ? "Update" : "Set Token"}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {token?.is_set && (
                                            <button
                                                onClick={() => handleDeleteToken(key)}
                                                className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors ml-4"
                                                aria-label="Delete token"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'profile' && (
                    <div className="bg-card text-card-foreground rounded-lg shadow-md p-6 min-w-[80vw] lg:min-w-[40vw]">
                        <h1 className="text-2xl font-bold text-foreground mb-6">Profile Settings</h1>
                        
                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div>
                                <label htmlFor="currentPassword" className="block text-sm font-medium text-foreground mb-1">
                                    Current Password
                                </label>
                                <input
                                    id="currentPassword"
                                    type="password"
                                    value={passwordForm.currentPassword}
                                    onChange={(e) => setPasswordForm(prev => ({
                                        ...prev,
                                        currentPassword: e.target.value
                                    }))}
                                    className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="newPassword" className="block text-sm font-medium text-foreground mb-1">
                                    New Password
                                </label>
                                <input
                                    id="newPassword"
                                    type="password"
                                    value={passwordForm.newPassword}
                                    onChange={(e) => setPasswordForm(prev => ({
                                        ...prev,
                                        newPassword: e.target.value
                                    }))}
                                    className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                                    required
                                    minLength={8}
                                />
                            </div>

                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1">
                                    Confirm New Password
                                </label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    value={passwordForm.confirmPassword}
                                    onChange={(e) => setPasswordForm(prev => ({
                                        ...prev,
                                        confirmPassword: e.target.value
                                    }))}
                                    className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                                    required
                                />
                            </div>

                            {passwordError && (
                                <p className="text-sm text-destructive">{passwordError}</p>
                            )}
                            {passwordSuccess && (
                                <p className="text-sm text-green-500">{passwordSuccess}</p>
                            )}

                            <button
                                type="submit"
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                            >
                                Change Password
                            </button>
                        </form>
                    </div>
                )}
            </main>
        </AuthLayout>
    );
} 