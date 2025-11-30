import { useState } from "react";
import { ThreadSearchResult } from "@/lib/entities";
import { searchThreadsSemantic } from "@/lib/services/threadService";

export const useThreadSearch = () => {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<ThreadSearchResult[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSearch = async (searchQuery: string) => {
		if (!searchQuery.trim()) {
			setResults([]);
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const response = await searchThreadsSemantic({
				query: searchQuery,
				limit: 10,
			});
			setResults(response.results);
		} catch (err: any) {
			setError(err.message || "Failed to search threads");
			setResults([]);
		} finally {
			setIsLoading(false);
		}
	};

	const clearSearch = () => {
		setQuery("");
		setResults([]);
		setError(null);
	};

	return {
		query,
		setQuery,
		results,
		isLoading,
		error,
		handleSearch,
		clearSearch,
	};
};
