import SkillService from "@/lib/services/skillService";
import { Skill } from "@/lib/entities/skill";
import { useEffect, useState } from "react";

export type SkillState = {
	skill: Skill | null;
	skills: Skill[];
};

export const INIT_SKILL_STATE: SkillState = {
	skill: null,
	skills: [],
};

export function useSkill() {
	const [skill, setSkill] = useState<Skill | null>(INIT_SKILL_STATE.skill);
	const [skills, setSkills] = useState<Skill[]>([]);
	const [isLoadingSkills, setIsLoadingSkills] = useState(false);

	const handleGetSkills = async () => {
		setIsLoadingSkills(true);
		try {
			const response = await SkillService.search({ limit: 500 });
			setSkills(response.skills);
		} catch (error) {
			console.error("Failed to fetch skills:", error);
			setSkills([]);
		} finally {
			setIsLoadingSkills(false);
		}
	};

	const handleGetSkill = async (skillName: string) => {
		try {
			const response = await SkillService.get(skillName);
			setSkill(response);
		} catch (error) {
			console.error("Failed to fetch skill:", error);
			setSkill(null);
		}
	};

	const handleToggleSkill = async (name: string) => {
		try {
			await SkillService.toggle(name);
			await handleGetSkills();
		} catch (error) {
			console.error("Failed to toggle skill:", error);
		}
	};

	const useEffectGetSkills = () => {
		useEffect(() => {
			handleGetSkills();
			return () => {
				setSkills([]);
			};
		}, []);
	};

	const useEffectGetSkill = (skillName: string) => {
		useEffect(() => {
			handleGetSkill(skillName);
		}, [skillName]);
	};

	return {
		skill,
		setSkill,
		skills,
		isLoadingSkills,
		handleGetSkills,
		handleGetSkill,
		handleToggleSkill,
		useEffectGetSkills,
		useEffectGetSkill,
	};
}

export default useSkill;
