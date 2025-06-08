import { useState, useCallback } from 'react';
import apiClient from '../lib/utils/apiClient';

interface Token {
    key: string;
    is_set: boolean;
}

export function useTokens() {
    const [tokens, setTokens] = useState<Token[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchTokens = useCallback(async () => {
        try {
            const response = await apiClient.get('/tokens');
            setTokens(response.data.tokens || []);
        } catch (error) {
            console.error('Failed to fetch tokens');
        }
    }, []);

    const updateToken = async (key: string, value: string) => {
        setIsLoading(true);
        try {
            await apiClient.post('/tokens', { key, value });
            console.log('Token updated successfully');
            await fetchTokens();
        } catch (error: any) {
            console.error(error.response?.data?.detail || 'Failed to update token');
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const deleteToken = async (key: string) => {
        try {
            await apiClient.delete(`/tokens/${key}`);
            console.log('Token deleted successfully');
            await fetchTokens();
        } catch (error) {
            console.error('Failed to delete token');
            throw error;
        }
    };

    return {
        tokens,
        isLoading,
        fetchTokens,
        updateToken,
        deleteToken
    };
} 