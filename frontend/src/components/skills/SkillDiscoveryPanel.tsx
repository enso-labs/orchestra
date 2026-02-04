import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Search, AlertCircle } from "lucide-react";
import { useSkills } from "@/hooks/useSkills";
import { SkillCard } from "./SkillCard";
import { Skill } from "@/lib/entities/skill";

interface SkillDiscoveryPanelProps {
	onSkillSelect?: (skill: Skill) => void;
}

export function SkillDiscoveryPanel({ onSkillSelect }: SkillDiscoveryPanelProps) {
	const { skills, isLoading, error } = useSkills();
	const [searchQuery, setSearchQuery] = useState("");

	const filteredSkills = useMemo(() => {
		if (!searchQuery.trim()) return skills;
		const query = searchQuery.toLowerCase();
		return skills.filter(
			(skill) =>
				skill.name.toLowerCase().includes(query) ||
				skill.description.toLowerCase().includes(query) ||
				skill.category?.toLowerCase().includes(query)
		);
	}, [skills, searchQuery]);

	return (
		<div className="flex flex-col h-full">
			<div className="border-b px-6 py-4">
				<h2 className="text-xl font-semibold mb-3">Skill Discovery</h2>
				<div className="relative">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search skills..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>
			</div>

			<div className="flex-1 overflow-auto p-6">
				{isLoading && (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				)}

				{error && (
					<div className="flex items-center justify-center py-12 text-destructive">
						<AlertCircle className="h-5 w-5 mr-2" />
						<span>{error}</span>
					</div>
				)}

				{!isLoading && !error && filteredSkills.length === 0 && (
					<div className="flex items-center justify-center py-12 text-muted-foreground">
						<span>No skills found</span>
					</div>
				)}

				{!isLoading && !error && filteredSkills.length > 0 && (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{filteredSkills.map((skill) => (
							<SkillCard
								key={skill.slug}
								skill={skill}
								onClick={() => onSkillSelect?.(skill)}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
