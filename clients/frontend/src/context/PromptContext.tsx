import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import promptService from "@/lib/services/promptService";
import { Prompt } from "@/lib/entities/prompt";

type PromptContextType = {
	prompts: Prompt[];
	selectedPrompt: Prompt | null;
	useEffectRefreshPrompts: () => void;
	setSelectedPrompt: (prompt: Prompt | null) => void;
	refreshPrompts: () => Promise<void>;
	isLoading: boolean;
	error: string | null;
};

const PromptContext = createContext<PromptContextType | undefined>(undefined);

export const PromptProvider = ({ children }: { children: ReactNode }) => {
	const [prompts, setPrompts] = useState<Prompt[]>([]);
	const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refreshPrompts = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const response = await promptService.search({
				limit: 500,
				sort: "updated_at",
				sort_order: "desc",
			});
			setPrompts(response.data.prompts || []);
		} catch (err) {
			console.error("Failed to fetch prompts:", err);
			setError("Failed to load prompts. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const useEffectRefreshPrompts = () => {
		useEffect(() => {
			refreshPrompts();
		}, []);

		return () => {
			setPrompts([]);
		};
	};

	return (
		<PromptContext.Provider
			value={{
				prompts,
				selectedPrompt,
				setSelectedPrompt,
				refreshPrompts,
				isLoading,
				error,
				useEffectRefreshPrompts,
			}}
		>
			{children}
		</PromptContext.Provider>
	);
};

export const usePromptContext = () => {
	const context = useContext(PromptContext);
	if (!context) {
		throw new Error("usePromptContext must be used within PromptProvider");
	}
	return context;
};
