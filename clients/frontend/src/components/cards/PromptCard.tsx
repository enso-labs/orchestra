import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, Globe, Lock } from "lucide-react";
import { Prompt } from "@/lib/entities/prompt";

interface PromptCardProps {
	prompt: Prompt;
	onClick?: () => void;
}

export function PromptCard({ prompt, onClick }: PromptCardProps) {
	const formatDate = (dateString?: string) => {
		if (!dateString) return "No date";
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	const truncateContent = (content: string, maxLength: number = 100) => {
		if (content.length <= maxLength) return content;
		return content.substring(0, maxLength) + "...";
	};

	return (
		<Card
			className="cursor-pointer hover:shadow-lg transition-shadow duration-200 group"
			onClick={onClick}
		>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<FileText className="h-5 w-5 text-primary flex-shrink-0" />
					<div className="flex items-center gap-2">
						{prompt.v && (
							<Badge variant="outline" className="text-xs">
								v{prompt.v}
							</Badge>
						)}
					</div>
				</div>
				<CardTitle className="text-base group-hover:text-primary transition-colors line-clamp-2">
					{prompt.name}
				</CardTitle>
				<CardDescription className="text-xs line-clamp-3">
					{truncateContent(prompt.content)}
				</CardDescription>
			</CardHeader>
			<CardContent className="pt-0">
				<div className="space-y-2">
					{/* Public/Private Badge */}
					<div className="flex items-center justify-between">
						<Badge
							variant={prompt.public ? "default" : "secondary"}
							className="text-xs gap-1"
						>
							{prompt.public ? (
								<>
									<Globe className="h-3 w-3" />
									Public
								</>
							) : (
								<>
									<Lock className="h-3 w-3" />
									Private
								</>
							)}
						</Badge>
						<div className="flex items-center gap-1 text-xs text-muted-foreground">
							<Calendar className="h-3 w-3" />
							<span>{formatDate(prompt.updated_at)}</span>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
