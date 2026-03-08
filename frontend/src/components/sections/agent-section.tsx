import ChatInput from "@/components/inputs/ChatInput";
import { Agent } from "@/lib/services/agentService";
import { Button } from "@/components/ui/button";
import { BookOpen, Newspaper, Share2, MessageCircle } from "lucide-react";

interface AgentSectionProps {
	agent: Agent;
	showAgentMenu?: boolean;
}

export function AgentSection({
	agent,
	showAgentMenu = false,
}: AgentSectionProps) {
	return (
		<>
			<img
				src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4"
				alt="Logo"
				className="w-32 h-32 mx-auto rounded-full"
			/>
			<h1 className="text-4xl font-bold mt-2 italic">{agent.name}</h1>
			<p className="text-lg text-muted-foreground mb-2">{agent.description}</p>

			<div className="flex flex-col w-full lg:w-[600px]">
				<ChatInput showAgentMenu={showAgentMenu} />
			</div>

			{/* Links below input */}
			<div className="flex flex-row flex-wrap justify-center gap-1 mt-3">
				<Button
					variant="ghost"
					size="sm"
					className="text-muted-foreground hover:text-foreground h-8"
					asChild
				>
					<a
						href="https://docs.ruska.ai"
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
						href="https://ruska.ai/blog"
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
						href="https://ruska.ai/socials"
						target="_blank"
						rel="noopener noreferrer"
					>
						<Share2 className="w-4 h-4 mr-1" />
						Social
					</a>
				</Button>
				<Button
					variant="ghost"
					size="sm"
					className="text-muted-foreground hover:text-foreground h-8"
					asChild
				>
					<a
						href="https://join.slack.com/t/ruska-ai/shared_invite/zt-3l2lnevo6-hOe5ZeoAz~xj7CFAJk2bzg"
						target="_blank"
						rel="noopener noreferrer"
					>
						<MessageCircle className="w-4 h-4 mr-1" />
						Slack
					</a>
				</Button>
			</div>
		</>
	);
}

export default AgentSection;
