import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Globe } from "lucide-react";
import { useChatContext } from "@/context/ChatContext";

function SearchButton() {
	const { setPayload } = useChatContext();

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="outline"
						className="rounded-full bg-foreground/10 text-foreground-500 px-3 hover:bg-foreground/15 transition-colors"
						aria-label="Search the web"
						onClick={() =>
							setPayload((prev: any) => {
								const searchEngineExists = prev.tools?.some(
									(tool: string) => tool === "search_engine",
								);

								if (searchEngineExists) {
									// Remove search_engine if it already exists
									return {
										...prev,
										tools: prev.tools.filter(
											(tool: string) => tool !== "search_engine",
										),
									};
								} else {
									// Add search_engine if it doesn't exist
									return {
										...prev,
										tools: [...(prev.tools || []), "search_engine"],
									};
								}
							})
						}
					>
						<Globe className="h-4 w-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>Search </p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export default SearchButton;
