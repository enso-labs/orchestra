import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Wrench } from "lucide-react";
import { Skill } from "@/lib/entities/skill";

interface SkillCardProps {
	skill: Skill;
	onClick?: () => void;
}

export function SkillCard({ skill, onClick }: SkillCardProps) {
	return (
		<Card
			className="cursor-pointer hover:shadow-lg transition-shadow duration-200 group"
			onClick={onClick}
		>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
					{skill.category && (
						<Badge variant="outline" className="text-xs">
							{skill.category}
						</Badge>
					)}
				</div>
				<CardTitle className="text-base group-hover:text-primary transition-colors line-clamp-1">
					{skill.name}
				</CardTitle>
				<CardDescription className="text-xs line-clamp-2">
					{skill.description}
				</CardDescription>
			</CardHeader>
			<CardContent className="pt-0">
				{skill.tools && skill.tools.length > 0 && (
					<div className="flex items-center gap-1 text-xs text-muted-foreground">
						<Wrench className="h-3 w-3" />
						<span>{skill.tools.length} tools</span>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
