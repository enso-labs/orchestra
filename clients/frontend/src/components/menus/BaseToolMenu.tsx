import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Globe } from "lucide-react";
import { DropdownMenuCheckboxItemProps } from "@radix-ui/react-dropdown-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAgentContext } from "@/context/AgentContext";
import ImageUpload from "../inputs/ImageUpload";

type Checked = DropdownMenuCheckboxItemProps["checked"];

const DEFAULT_AGENT_TOOLS = ["web_search", "web_scrape"];

export function BaseToolMenu() {
	const { agent, setAgent } = useAgentContext();
	const [open, setOpen] = useState<boolean>(false);
	const [webSearchCheck, setWebSearchCheck] = useState<Checked>(() => {
		const saved = localStorage.getItem("enso:tool:search");
		return saved !== null ? JSON.parse(saved) : true;
	});

	useEffect(() => {
		setAgent({ ...agent, tools: [...agent.tools, ...DEFAULT_AGENT_TOOLS] });
	}, []);

	useEffect(() => {
		localStorage.setItem("enso:tool:search", JSON.stringify(webSearchCheck));
		if (webSearchCheck) {
			setAgent({
				...agent,
				tools: [...new Set([...agent.tools, ...DEFAULT_AGENT_TOOLS])],
			});
		} else {
			setAgent({
				...agent,
				tools: agent.tools.filter(
					(tool: string) => !DEFAULT_AGENT_TOOLS.includes(tool),
				),
			});
		}
	}, [webSearchCheck]);

	return (
		<DropdownMenu open={open}>
			<DropdownMenuTrigger asChild>
				<Button
					onClick={() => setOpen(!open)}
					size="icon"
					variant="outline"
					className="rounded-full ml-1 bg-foreground/10 text-foreground-500 cursor-pointer"
				>
					<Plus className="h-5 w-5" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="w-64 rounded-xl"
				align="start"
				onInteractOutside={() => setOpen(false)}
				onEscapeKeyDown={() => setOpen(false)}
			>
				<DropdownMenuGroup>
					<ImageUpload />
					<DropdownMenuSeparator className="h-px bg-muted-foreground/30" />
					<DropdownMenuItem
						onClick={() => setWebSearchCheck(!webSearchCheck)}
						className="flex items-center gap-3 cursor-pointer text-base rounded-lg"
					>
						<Globe className="h-12 w-12" />
						<span>Web Search {webSearchCheck ? "✅" : "🚫"}</span>
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export default BaseToolMenu;
