import ChatInput from "@/components/inputs/ChatInput";

export function ChatSection() {
	return (
		<>
			<img
				src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4"
				alt="Logo"
				className="w-32 h-32 mx-auto rounded-full"
			/>
			<h1 className="text-4xl font-bold mt-2">Ensō Orchestra</h1>
			<p className="text-lg mb-2">
				AI Orchestrator powered by{" "}
				<a
					href="https://github.com/ruska-ai/mcp-sse"
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary hover:underline"
				>
					MCP
				</a>{" "}
				&{" "}
				<a
					href="https://github.com/ruska-ai/a2a-langgraph"
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary hover:underline"
				>
					A2A
				</a>
			</p>
			<div className="flex flex-row gap-2 mb-2">
				<a href="https://discord.com/invite/QRfjg4YNzU">
					<img src="https://img.shields.io/badge/Join-Discord-purple" />
				</a>
				<a href="https://enso.sh/socials">
					<img src="https://img.shields.io/badge/Follow-Social-black" />
				</a>
				<a href="https://docs.ruska.ai">
					<img src="https://img.shields.io/badge/View-Docs-blue" />
				</a>
			</div>
			<div className="flex flex-col w-full lg:w-[600px]">
				<ChatInput showAgentMenu={true} />
			</div>
		</>
	);
}

export default ChatSection;
