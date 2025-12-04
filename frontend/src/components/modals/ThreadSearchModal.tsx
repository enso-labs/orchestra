import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useThreadSearch } from "@/hooks/useThreadSearch";
import { formatContent } from "@/lib/utils/format";

interface ThreadSearchModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export function ThreadSearchModal({ isOpen, onClose }: ThreadSearchModalProps) {
	const navigate = useNavigate();
	const { query, setQuery, results, isLoading, error, handleSearch, clearSearch } = useThreadSearch();

	useEffect(() => {
		if (!isOpen) {
			clearSearch();
		}
	}, [isOpen]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		handleSearch(query);
	};

	const handleResultClick = (threadId: string) => {
		navigate(`/thread/${threadId}`);
		onClose();
	};

	const formatTimestamp = (timestamp: string | null) => {
		if (!timestamp) return "";
		try {
			return new Date(timestamp).toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
			});
		} catch {
			return "";
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Search className="h-5 w-5" />
						Search Threads
					</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="relative">
						<Input
							autoFocus
							placeholder="Search conversations..."
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							className="pr-10"
						/>
						{isLoading && (
							<Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
						)}
					</div>
				</form>

				<div className="flex-1 overflow-y-auto space-y-2 min-h-[200px]">
					{isLoading && results.length === 0 && (
						<div className="flex items-center justify-center h-full text-muted-foreground">
							<Loader2 className="h-6 w-6 animate-spin" />
						</div>
					)}

					{!isLoading && query && results.length === 0 && (
						<div className="flex items-center justify-center h-full text-center text-muted-foreground">
							<p>
								No threads found matching your search. Try different keywords.
							</p>
						</div>
					)}

					{error && (
						<div className="flex items-center justify-center h-full text-center text-red-500">
							<p>{error}</p>
						</div>
					)}

					{results.map((result) => (
						<div
							key={result.id}
							onClick={() => handleResultClick(result.id)}
							className="p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
						>
							<div className="flex items-start justify-between gap-2">
								<div className="flex-1 min-w-0">
									{/* <h4 className="font-medium truncate">
										{result.messages && result.messages.length > 0
											? result.messages[result.messages.length - 1].content
											: "No message content"}
									</h4> */}
									<p className="text-sm line-clamp-2 mt-1">
										{result.messages && result.messages.length > 0
											? formatContent(result.messages[result.messages.length - 1].content)
											: "No message content"}
									</p>
									{result.updated_at && (
										<p className="text-xs text-muted-foreground mt-1">
											{formatTimestamp(result.updated_at)}
										</p>
									)}
								</div>
								{result.score > 0 && (
									<div className="text-xs text-muted-foreground whitespace-nowrap">
										{(result.score * 100).toFixed(0)}%
									</div>
								)}
							</div>
						</div>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
