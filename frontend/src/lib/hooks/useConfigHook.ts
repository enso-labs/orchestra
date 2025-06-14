import apiClient from "@/lib/utils/apiClient";
import { useChatReducer } from "@/lib/reducers/chatReducer";
import { getAuthToken } from "@/lib/utils/auth";
import { useEffect } from "react";

function useConfigHook() {
	const {state, actions} = useChatReducer();
	const {settings} = state;
	const {setSettings} = actions;

	const fetchSettings = async () => {
		try {
			const response = getAuthToken() ? await apiClient.get('/settings') : null;
			setSettings(response?.data?.settings || []);
		} catch (error) {
			console.error('Failed to fetch settings:', error);
		}
	};

	// Add this effect hook after useToolsEffect
	const useSettingsEffect = () => {
		useEffect(() => {
			fetchSettings();
		}, []);

		return () => {
			// Cleanup logic if needed
		};
	};

	return { 
		// State
		settings,
		setSettings,
		// Actions 
		fetchSettings,
		// Effects
		useSettingsEffect
	};
}

export default useConfigHook;