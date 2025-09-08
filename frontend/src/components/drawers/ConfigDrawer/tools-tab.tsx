import { useState, useEffect, useRef } from "react";
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

type Tool = {
	id: string;
	name: string;
	description: string;
	category: string;
	tags: string[];
};

type ToolsTabProps = {
	category?: string;
};

const TOOLS_DATA: Tool[] = [
	{
		id: "1",
		name: "Text Analyzer",
		description: "Analyze text for sentiment, entities, and key phrases",
		category: "Text",
		tags: ["NLP", "Analysis"],
	},
	{
		id: "2",
		name: "Image Generator",
		description: "Generate images from text descriptions",
		category: "Image",
		tags: ["AI", "Generation"],
	},
	{
		id: "3",
		name: "Code Assistant",
		description: "Get help with coding problems and questions",
		category: "Code",
		tags: ["Programming", "Help"],
	},
	{
		id: "4",
		name: "Data Visualizer",
		description: "Create visualizations from data sets",
		category: "Data",
		tags: ["Visualization", "Charts"],
	},
	{
		id: "5",
		name: "Translation Tool",
		description: "Translate text between languages",
		category: "Text",
		tags: ["Translation", "Language"],
	},
	{
		id: "6",
		name: "Audio Transcriber",
		description: "Transcribe audio to text",
		category: "Audio",
		tags: ["Transcription", "Speech"],
	},
	{
		id: "7",
		name: "MCP Connector",
		description: "Connect to MCP services and APIs",
		category: "MCP",
		tags: ["Integration", "API"],
	},
	{
		id: "8",
		name: "A2A Messenger",
		description: "Send messages between AI agents",
		category: "A2A",
		tags: ["Communication", "Agents"],
	},
	{
		id: "9",
		name: "Arcade Game Creator",
		description: "Create simple games for the AI Arcade",
		category: "Arcade",
		tags: ["Games", "Creation"],
	},
	{
		id: "10",
		name: "MCP Data Analyzer",
		description: "Analyze data from MCP sources",
		category: "MCP",
		tags: ["Analysis", "Data"],
	},
	{
		id: "11",
		name: "A2A Protocol Tester",
		description: "Test A2A communication protocols",
		category: "A2A",
		tags: ["Testing", "Protocol"],
	},
	{
		id: "12",
		name: "Arcade Asset Manager",
		description: "Manage assets for Arcade games",
		category: "Arcade",
		tags: ["Assets", "Management"],
	},
];

const CATEGORIES = [
	"All",
	"Text",
	"Image",
	"Code",
	"Data",
	"Audio",
	"MCP",
	"A2A",
	"Arcade",
];

export function ToolsTab({ category }: ToolsTabProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string>(
		category || "All",
	);
	const [visibleTools, setVisibleTools] = useState<Tool[]>([]);
	const [page, setPage] = useState(1);
	const loaderRef = useRef<HTMLDivElement>(null);
	const ITEMS_PER_PAGE = 6;

	// Filter tools based on search query, category, and pagination
	useEffect(() => {
		let filtered = [...TOOLS_DATA];

		// Filter by tab category if provided
		if (category) {
			filtered = filtered.filter((tool) => tool.category === category);
		}

		// Filter by selected category (if not "All")
		if (selectedCategory !== "All" && !category) {
			filtered = filtered.filter((tool) => tool.category === selectedCategory);
		}

		// Filter by search query
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(tool) =>
					tool.name.toLowerCase().includes(query) ||
					tool.description.toLowerCase().includes(query) ||
					tool.tags.some((tag) => tag.toLowerCase().includes(query)),
			);
		}

		// Slice for pagination
		setVisibleTools(filtered.slice(0, page * ITEMS_PER_PAGE));
	}, [searchQuery, selectedCategory, page, category]);

	// Intersection observer for infinite scroll
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					setPage((prevPage) => prevPage + 1);
				}
			},
			{ threshold: 1.0 },
		);

		if (loaderRef.current) {
			observer.observe(loaderRef.current);
		}

		return () => {
			if (loaderRef.current) {
				observer.unobserve(loaderRef.current);
			}
		};
	}, []);

	return (
		<div className="space-y-4">
			<div className="sticky top-0 bg-background pt-2 pb-4 z-10">
				<div className="flex items-center space-x-2 mb-4">
					<div className="relative flex-1">
						<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search tools..."
							className="pl-8"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>
					<Button variant="outline" size="icon">
						<Filter className="h-4 w-4" />
					</Button>
				</div>

				{!category && (
					<div className="flex overflow-x-auto pb-2 space-x-2 no-scrollbar">
						{CATEGORIES.map((cat) => (
							<Badge
								key={cat}
								variant={selectedCategory === cat ? "default" : "outline"}
								className="cursor-pointer"
								onClick={() => setSelectedCategory(cat)}
							>
								{cat}
							</Badge>
						))}
					</div>
				)}
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{visibleTools.map((tool) => (
					<Card key={tool.id}>
						<CardHeader className="pb-2">
							<CardTitle>{tool.name}</CardTitle>
							<CardDescription>{tool.description}</CardDescription>
						</CardHeader>
						<CardContent className="pb-2">
							<div className="flex flex-wrap gap-2">
								{tool.tags.map((tag) => (
									<Badge key={tag} variant="outline">
										{tag}
									</Badge>
								))}
							</div>
						</CardContent>
						<CardFooter>
							<Button variant="outline" size="sm" className="w-full">
								Open Tool
							</Button>
						</CardFooter>
					</Card>
				))}
			</div>

			{/* Loader element for infinite scroll */}
			<div ref={loaderRef} className="h-4" />
		</div>
	);
}
