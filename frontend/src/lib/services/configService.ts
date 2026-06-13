import apiClient from "@/lib/utils/apiClient";
import type { Branding } from "@/lib/config/branding";

/** Fetch public white-label branding/links (no secrets). */
export const getPublicConfig = async (): Promise<Branding> => {
	const response = await apiClient.get("/config/public");
	return response.data;
};
