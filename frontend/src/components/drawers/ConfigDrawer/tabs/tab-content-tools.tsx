import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
	X, Database, 
	Search, BookOpen, PlusCircle,
	Filter
} from "lucide-react";
import ToolCard from "@/components/cards/ToolCard";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useToolContext } from "@/context/ToolContext";
import { useChatContext } from "@/context/ChatContext";
import { useNavigate } from "react-router-dom";

function TabContentTools() {
	const navigate = useNavigate();
	const [searchFocused, setSearchFocused] = useState(false);
	const [activeCategory, setActiveCategory] = useState<string | null>(null);
	const [groupByCategory, setGroupByCategory] = useState(true);
	
	// Get functionality from tool context
	const { 
		clearTools, 
		toolFilter, 
		toolsByCategory,
		filteredTools,
		hasSavedA2A
	} = useToolContext();
	
	const { payload, useToolsEffect } = useChatContext();
	
	// Get current enabled tools count
	const enabledCount = (payload.tools?.length || 0);
	
	// Reset active category when changing view mode
	useEffect(() => {
		setActiveCategory(null);
	}, [groupByCategory]);

	// Get unique categories from toolsByCategory
	const categories = Object.keys(toolsByCategory);
	
	// Handle tool filter changes - we'll use the one from context
	const setToolFilter = (value: string) => {
		// Access the setToolFilter function from context
		(useToolContext() as any).setToolFilter(value);
	};

	useToolsEffect();

	return (
		<div className="p-4">
			<div className="mb-4 pb-4 border-b">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-xl font-semibold">
							Tools
							{enabledCount > 0 && (
								<Badge variant="secondary" className="ml-2 font-normal">
									{enabledCount} enabled
								</Badge>
							)}
						</h2>
						<p className="text-sm text-muted-foreground mt-1">
							Choose the tools that will help you be more present in this moment.
						</p>
					</div>
					<div className="flex space-x-1">
						<TooltipProvider>
							{enabledCount > 0 && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
											onClick={clearTools}
										>
											<X className="h-4 w-4" />
										</Button>
									</TooltipTrigger>
									<TooltipContent side="bottom">
										<p className="text-xs">Clear all selected tools</p>
									</TooltipContent>
								</Tooltip>
							)}

							{/* A2A */}
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 relative"
										onClick={() => navigate("/tools/create")}
									>
										<PlusCircle className="h-4 w-4" />
										{hasSavedA2A && (
											<span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" />
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent side="bottom">
									<p className="text-xs">
										{hasSavedA2A ? "Edit A2A configuration" : "Add A2A configuration"}
									</p>
								</TooltipContent>
							</Tooltip>
							
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
										onClick={() => setGroupByCategory(!groupByCategory)}
									>
										{groupByCategory ? (
											<Database className="h-4 w-4" />
										) : (
											<BookOpen className="h-4 w-4" />
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent side="bottom">
									<p className="text-xs">
										{groupByCategory ? "Show as list" : "Group by category"}
									</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
				</div>
			</div>
			
			<div className="mb-5 space-y-3">
				<div className={cn(
					"relative transition-all duration-200",
					searchFocused ? "ring-2 ring-primary ring-offset-1" : ""
				)}>
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search for tools..."
						className="w-full pl-10 py-2.5 px-4 text-sm rounded-md bg-muted/30 border border-input"
						onChange={(e) => setToolFilter(e.target.value)}
						value={toolFilter}
						onFocus={() => setSearchFocused(true)}
						onBlur={() => setSearchFocused(false)}
					/>
					{toolFilter && (
						<button 
							className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 rounded-full bg-muted/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
							onClick={() => setToolFilter("")}
							aria-label="Clear search"
						>
							<X className="h-3 w-3" />
						</button>
					)}
				</div>
				
				{groupByCategory && (
					<div className="flex flex-wrap gap-1.5 items-center">
						<Badge 
							variant={activeCategory === null ? "secondary" : "outline"}
							className={cn(
								"cursor-pointer hover:bg-secondary/80 transition-colors",
								activeCategory === null ? "bg-secondary" : ""
							)}
							onClick={() => setActiveCategory(null)}
						>
							All
						</Badge>
						{categories.map((category) => (
							<Badge 
								key={category}
								variant={activeCategory === category ? "secondary" : "outline"}
								className={cn(
									"cursor-pointer hover:bg-secondary/80 transition-colors",
									activeCategory === category ? "bg-secondary" : ""
								)}
								onClick={() => setActiveCategory(category)}
							>
								{category}
							</Badge>
						))}
					</div>
				)}
			</div>
			
			<ScrollArea className="h-[calc(100vh-300px)]">
				<div className="grid gap-4">
					{groupByCategory ? (
						Object.entries(toolsByCategory)
							.filter(([category]) => activeCategory === null || category === activeCategory)
							.map(([category, tools]) => (
								<div key={category} className="mb-4">
									<div className="flex items-center gap-2 mb-3">
										<h3 className="text-sm font-medium text-foreground">{category}</h3>
										<Badge variant="outline" className="text-xs font-normal text-muted-foreground">
											{(tools as any[]).length}
										</Badge>
									</div>
									<div className="grid gap-2.5">
										{(tools as any[]).map((tool: any) => (
											<ToolCard key={tool.id} tool={tool} />
										))}
									</div>
								</div>
							))
					) : (
						<div className="grid gap-2.5">
							{filteredTools.map((tool: any) => (
								<ToolCard key={tool.id} tool={tool} />
							))}
						</div>
					)}
					
					{((groupByCategory && Object.keys(toolsByCategory).length === 0) || 
					 (!groupByCategory && filteredTools.length === 0)) && (
						<div className="flex flex-col items-center justify-center py-10 text-center">
							<Filter className="h-10 w-10 text-muted-foreground/50 mb-2" />
							<p className="text-muted-foreground text-sm">
								No tools match your search criteria
							</p>
							{toolFilter && (
								<Button 
									variant="link" 
									className="mt-1 h-auto p-0" 
									onClick={() => setToolFilter("")}
								>
									Clear search
								</Button>
							)}
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}

export default TabContentTools;