import debug from "debug";
import { useEffect, useState } from "react";
import { APP_ENV, APP_VERSION } from "../lib/config";
import apiClient from "@/lib/utils/apiClient";

debug.enable("hooks:*");
// const logger = debug('hooks:useAppHook');

const INIT_APP_STATE = {
	loading: false,
	loadingMessage: "",
	appVersion: APP_VERSION,
	isMenuOpen: false,
	isDrawerOpen: false,
};

export default function useAppHook() {
	const [loading, setLoading] = useState(INIT_APP_STATE.loading);
	const [loadingMessage, setLoadingMessage] = useState(
		INIT_APP_STATE.loadingMessage,
	);
	const [appVersion, setAppVersion] = useState(INIT_APP_STATE.appVersion);
	const [isMenuOpen, setIsMenuOpen] = useState(INIT_APP_STATE.isMenuOpen);
	const [isDrawerOpen, setIsDrawerOpen] = useState(INIT_APP_STATE.isDrawerOpen);

	const isMobile = () => {
		const isClient = typeof window === "object";

		// Function to check window size and return isOpen state
		const getSize = () => {
			return window.innerWidth < 768;
		};

		return isClient ? getSize() : false;
	};

	const fetchAppVersion = async () => {
		const response = await apiClient.get("/info");
		setAppVersion(response.data.version);
	};

	const useFetchAppVersionEffect = () => {
		useEffect(() => {
			fetchAppVersion();

			return () => {
				// Cleanup logic if needed
			};
		}, []);
	};

	const handleMenuOpen = () => {
		setIsMenuOpen(!isMenuOpen);
	};

	function useIsMobile() {
		const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

		useEffect(() => {
			const mql = window.matchMedia(`(max-width: ${768 - 1}px)`);
			const onChange = () => {
				setIsMobile(window.innerWidth < 768);
			};
			mql.addEventListener("change", onChange);
			setIsMobile(window.innerWidth < 768);
			return () => mql.removeEventListener("change", onChange);
		}, []);

		return !!isMobile;
	}

	const useDynamicScriptInjectEffect = () => {
		useEffect(() => {
			if (APP_ENV === "development") {
				const script = document.createElement("script");
				script.src = "https://cdn.jsdelivr.net/npm/eruda";
				script.async = true;
				script.onload = () => {
					(window as any).eruda.init();
				};
				document.head.appendChild(script);
				return () => {
					document.head.removeChild(script);
				};
			}
			return;
		}, []);

		return null;
	};

	return {
		appVersion,
		isMobile,
		useFetchAppVersionEffect,
		loading,
		setLoading,
		loadingMessage,
		setLoadingMessage,
		isMenuOpen,
		handleMenuOpen,
		useIsMobile,
		useDynamicScriptInjectEffect,
		isDrawerOpen,
		setIsDrawerOpen,
	};
}
