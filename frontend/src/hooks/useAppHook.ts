import debug from 'debug';
import { useEffect, useState } from "react";
import { APP_VERSION } from '../config';
import apiClient from '@/lib/utils/apiClient';

debug.enable('hooks:*');
// const logger = debug('hooks:useAppHook');

const INIT_APP_STATE = {
    appVersion: APP_VERSION,
}

export default function useAppHook() {
    const [appVersion, setAppVersion] = useState(INIT_APP_STATE.appVersion);
    const [loading, setLoading] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');

    const isMobile = () => {
        const isClient = typeof window === "object";

        // Function to check window size and return isOpen state
        const getSize = () => {
            return window.innerWidth < 768;
        };

        return isClient ? getSize() : false;
    };

    const fetchAppVersion = async () => {
        const response = await apiClient.get('/info');
        setAppVersion(response.data.version);
    }

    const useFetchAppVersionEffect = () => {
        useEffect(() => {
            fetchAppVersion();

            return () => {
                // Cleanup logic if needed
            };
        }, []);
    }

    const handleMenuOpen = () => {
        setIsMenuOpen(!isMenuOpen);
    }

    return {
        appVersion,
        isMobile,
        useFetchAppVersionEffect,
        loading,
        setLoading,
        loadingMessage,
        setLoadingMessage,
        isMenuOpen,
        handleMenuOpen
    }
}