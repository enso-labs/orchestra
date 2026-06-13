import ChatInput from "@/components/inputs/ChatInput";
import ChatUtilityRow from "@/components/chat/ChatUtilityRow";
import { Agent } from "@/lib/services/agentService";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/context/BrandingContext";
import {
	BookOpen,
	Newspaper,
	Share2,
	MessageCircle,
	GitFork,
	Loader2,
} from "lucide-react";

interface AgentSectionProps {
	agent: Agent;
	showAgentMenu?: boolean;
	showSandboxStatus?: boolean;
	onRemix?: () => void;
	isForking?: boolean;
}

export function AgentSection({
	agent,
	showAgentMenu = false,
	showSandboxStatus = false,
	onRemix,
	isForking = false,
}: AgentSectionProps) {
	const branding = useBranding();
	return (
		<>
			<img
				src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4"
				alt="Logo"
				className="w-32 h-32 mx-auto rounded-full"
			/>
			<h1 className="text-4xl font-bold mt-2 italic">{agent.name}</h1>
			<p className="text-lg text-muted-foreground mb-2">{agent.description}</p>

			<div className="flex w-full flex-col gap-2 lg:w-[600px]">
				{showSandboxStatus && <ChatUtilityRow />}
				<ChatInput showAgentMenu={showAgentMenu} />
			</div>

			{/* Remix button */}
			{onRemix && (
				<div className="mt-3">
					<Button
						variant="outline"
						size="sm"
						onClick={onRemix}
						disabled={isForking}
						className="h-8"
					>
						{isForking ? (
							<Loader2 className="w-4 h-4 mr-1 animate-spin" />
						) : (
							<GitFork className="w-4 h-4 mr-1" />
						)}
						{isForking ? "Remixing..." : "Remix this Agent"}
					</Button>
				</div>
			)}

			{/* Links below input */}
			<div className="flex flex-row flex-wrap justify-center gap-1 mt-3">
				<Button
					variant="ghost"
					size="sm"
					className="text-muted-foreground hover:text-foreground h-8"
					asChild
				>
					<a
						href={branding.urls.docs}
						target="_blank"
						rel="noopener noreferrer"
					>
						<BookOpen className="w-4 h-4 mr-1" />
						Docs
					</a>
				</Button>
				<Button
					variant="ghost"
					size="sm"
					className="text-muted-foreground hover:text-foreground h-8"
					asChild
				>
					<a
						href={branding.urls.blog}
						target="_blank"
						rel="noopener noreferrer"
					>
						<Newspaper className="w-4 h-4 mr-1" />
						Blog
					</a>
				</Button>
				<Button
					variant="ghost"
					size="sm"
					className="text-muted-foreground hover:text-foreground h-8"
					asChild
				>
					<a
						href={branding.urls.socials}
						target="_blank"
						rel="noopener noreferrer"
					>
						<Share2 className="w-4 h-4 mr-1" />
						Social
					</a>
				</Button>
				{branding.urls.slack_invite && (
					<Button
						variant="ghost"
						size="sm"
						className="text-muted-foreground hover:text-foreground h-8"
						asChild
					>
						<a
							href={branding.urls.slack_invite}
							target="_blank"
							rel="noopener noreferrer"
						>
							<MessageCircle className="w-4 h-4 mr-1" />
							Slack
						</a>
					</Button>
				)}
			</div>
		</>
	);
}

export default AgentSection;
