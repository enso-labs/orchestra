import ChatInput from "@/components/inputs/ChatInput";
import { useAgentContext } from "@/context/AgentContext";

export function AgentSection() {
	const { agent } = useAgentContext();
	return (
		<>
			<img
				src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4"
				alt="Logo"
				className="w-32 h-32 mx-auto rounded-full"
			/>
			<h1 className="text-4xl font-bold mt-2">{agent.name}</h1>
			<p className="text-lg mb-2">{agent.description}</p>
			<div className="flex flex-row gap-2 mb-2">
				{agent.mcp && (
					<a href={agent.mcp.url}>
						<img src="https://img.shields.io/badge/View-MCP-blue" />
					</a>
				)}
				{agent.a2a && (
					<a href={agent.a2a.url}>
						<img src="https://img.shields.io/badge/View-A2A-blue" />
					</a>
				)}
			</div>
			<div className="flex flex-col w-full lg:w-[600px]">
				<ChatInput showAgentMenu={false} />
			</div>
		</>
	);
}

export default AgentSection;
