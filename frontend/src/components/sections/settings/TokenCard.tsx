import { Trash2, Eye, EyeOff } from 'lucide-react';

interface Token {
    key: string;
    is_set: boolean;
}

interface TokenEdit {
    value: string;
    showValue: boolean;
}

interface TokenCardProps {
    tokenKey: string;
    token?: Token;
    isEditing: boolean;
    editToken?: TokenEdit;
    isLoading: boolean;
    onStartEditing: () => void;
    onCancelEditing: () => void;
    onUpdateEditing: (updates: Partial<TokenEdit>) => void;
    onSave: () => void;
    onDelete: () => void;
}

export default function TokenCard({
    tokenKey,
    token,
    isEditing,
    editToken,
    isLoading,
    onStartEditing,
    onCancelEditing,
    onUpdateEditing,
    onSave,
    onDelete
}: TokenCardProps) {
    return (
        <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border min-w-[80vw] lg:min-w-[60vw]">
            <div className="flex-1">
                <h3 className="font-medium text-foreground">{tokenKey}</h3>
                {isEditing ? (
                    <div className="mt-2 flex items-center gap-2">
                        <div className="relative flex-1">
                            <input
                                type={editToken?.showValue ? "text" : "password"}
                                value={editToken?.value || ''}
                                onChange={(e) => onUpdateEditing({ value: e.target.value })}
                                className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent pr-10"
                                placeholder="Enter token value"
                            />
                            <button
                                type="button"
                                onClick={() => onUpdateEditing({ showValue: !editToken?.showValue })}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {editToken?.showValue ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                        <button
                            onClick={onSave}
                            disabled={isLoading}
                            className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            Save
                        </button>
                        <button
                            onClick={onCancelEditing}
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
                            onClick={onStartEditing}
                            className="text-sm text-primary hover:underline"
                        >
                            {token?.is_set ? "Update" : "Set Token"}
                        </button>
                    </div>
                )}
            </div>
            {token?.is_set && (
                <button
                    onClick={onDelete}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors ml-4"
                    aria-label="Delete token"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            )}
        </div>
    );
} 