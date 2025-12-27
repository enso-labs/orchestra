import ChatInput from "@/components/inputs/ChatInput";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { FaGithub } from "react-icons/fa";
import { BookOpen, Newspaper, Share2, MessageCircle } from "lucide-react";
// import { PiAperture } from "react-icons/pi";

export function HomeSection() {
	return (
		<div className="w-full">
			{/* Desktop: 3-column grid (rule of thirds). Center column holds the primary content. */}
			<div className="grid grid-cols-1 lg:grid-cols-[1fr_42rem_1fr] gap-6 items-start">
				<div className="hidden lg:block" />
				<div className="flex flex-col items-center text-center">
					{/* <PiAperture className="w-32 h-32 sm:w-32 sm:h-32 rounded-full" /> */}
					<img
						src="https://github.com/ruska-ai/static/blob/master/ruska_logo_200.png?raw=true"
						alt="Logo"
						className="w-28 h-28 sm:w-32 sm:h-32 rounded-full"
					/>

					<h1 className="text-4xl font-bold italic mt-2">ORCHESTRA</h1>
					<p className="text-lg text-muted-foreground max-w-[42rem]">
						Steerable Harnesses built on{" "}
						<a
							href="https://docs.langchain.com/oss/python/deepagents/overview"
							target="_blank"
							rel="noopener noreferrer"
							className="underline hover:text-primary"
						>
							DeepAgents
						</a>
					</p>

					{/* ChatInput intentionally sits beneath Links */}
					<div className="flex flex-col w-full max-w-2xl mx-auto mt-4">
						<ChatInput />
					</div>

					{/* Links intentionally sit beneath Tagline */}
					<div className="flex flex-row flex-wrap justify-center gap-1 mt-3">
						<Button
							variant="ghost"
							size="sm"
							className="text-muted-foreground hover:text-foreground h-8"
							asChild
						>
							<a
								href="https://ruska.ai/docs/"
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

					{/* Auth CTA beneath links */}
					<div className="flex flex-col items-center gap-2 mt-4 w-full">
						<Button asChild size="lg" className="w-full max-w-sm">
							<Link to="/register">Get Started Free</Link>
						</Button>
						<p className="text-sm text-muted-foreground mt-2">
							Already have an account?{" "}
							<Link
								to="/login"
								className="text-primary hover:underline font-medium"
							>
								Sign in
							</Link>
						</p>
						<p className="text-lg text-muted-foreground mt-1 flex items-center justify-center gap-1">
							<a
								href="https://github.com/ruska-ai"
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline font-medium flex items-center gap-1"
							>
								Ruska Labs
								<FaGithub className="ml-1 mt-1 w-5 h-5" />
							</a>
						</p>
					</div>
				</div>
				<div className="hidden lg:block" />
			</div>
		</div>
	);
}

export default HomeSection;
