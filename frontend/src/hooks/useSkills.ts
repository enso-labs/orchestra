import { useState, useCallback, useEffect } from "react";
import { Skill } from "@/lib/entities/skill";
import SkillService from "@/lib/services/skillService";

export interface UseSkillsReturn {
	skills: Skill[];
	isLoading: boolean;
	error: string | null;
	refetch: () => Promise<void>;
}

export const useSkills = (category?: string): UseSkillsReturn => {
	const [skills, setSkills] = useState<Skill[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchSkills = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const response = await SkillService.listSkills(category);
			setSkills(response.skills || []);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to load skills";
			setError(errorMessage);
		} finally {
			setIsLoading(false);
		}
	}, [category]);

	useEffect(() => {
		fetchSkills();
	}, [fetchSkills]);

	return {
		skills,
		isLoading,
		error,
		refetch: fetchSkills,
	};
};
