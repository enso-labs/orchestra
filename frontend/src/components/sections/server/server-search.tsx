import { Search, X } from "lucide-react";

function ServerSearch({
	searchTerm,
	setSearchTerm,
	selectedCategories,
	setSelectedCategories,
}: {
	searchTerm: string;
	setSearchTerm: (searchTerm: string) => void;
	selectedCategories: string[];
	setSelectedCategories: (selectedCategories: string[]) => void;
}) {
	const clearFilters = () => {
		setSearchTerm("");
		setSelectedCategories([]);
	};

	return (
		<div className="bg-background/50 backdrop-blur-sm sticky top-0 z-10">
			<div className="flex flex-col space-y-4">
				<div className="flex flex-col sm:flex-row gap-4">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<input
							type="text"
							placeholder="Search agents..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="w-full h-10 pl-9 pr-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/70 transition-all"
						/>
						{searchTerm && (
							<button
								className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
								onClick={() => setSearchTerm("")}
								aria-label="Clear search"
							>
								<X className="h-3.5 w-3.5" />
							</button>
						)}
					</div>

					{selectedCategories.length > 0 && (
						<button
							className="h-10 px-3 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors"
							onClick={clearFilters}
						>
							Clear Filters ({selectedCategories.length})
							<X className="ml-2 h-3.5 w-3.5" />
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

export default ServerSearch;
