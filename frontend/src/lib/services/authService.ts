import apiClient from "@/lib/utils/apiClient";

export const login = async (email: string, password: string) => {
	const response = await apiClient.post("/auth/login", { email, password });
	return response.data;
};
