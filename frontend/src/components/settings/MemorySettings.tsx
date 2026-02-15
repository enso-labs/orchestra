import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Brain, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Memory } from "@/lib/entities/memory";
import MemoryService from "@/lib/services/memoryService";

export function MemorySettings() {
	const navigate = useNavigate();
	const [memories, setMemories] = useState<Memory[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [query, setQuery] = useState("");
	const [deleteTarget, setDeleteTarget] = useState<Memory | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const fetchMemories = useCallback(async (search?: string) => {
		setLoading(true);
		try {
			const res = await MemoryService.list({
				limit: 100,
				query: search || undefined,
			});
			setMemories(res.memories ?? []);
			setTotal(res.total ?? 0);
		} catch {
			toast.error("Failed to load memories");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchMemories();
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
				debounceRef.current = null;
			}
		};
	}, [fetchMemories]);

	const handleSearchChange = (value: string) => {
		setQuery(value);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			fetchMemories(value);
		}, 300);
	};

	const handleDelete = async () => {
		if (!deleteTarget) return;
		const removed = deleteTarget;
		const prevMemories = memories;
		const prevTotal = total;

		// Optimistic delete
		setMemories((m) => m.filter((mem) => mem.id !== removed.id));
		setTotal((t) => t - 1);
		setDeleteTarget(null);

		try {
			await MemoryService.delete(removed.id);
			toast.success("Memory deleted");
		} catch {
			// Rollback
			setMemories(prevMemories);
			setTotal(prevTotal);
			toast.error("Failed to delete memory");
		}
	};

	const handleToggle = async (memory: Memory) => {
		const prevMemories = memories;
		// Optimistic toggle
		setMemories((m) =>
			m.map((mem) =>
				mem.id === memory.id ? { ...mem, enabled: !mem.enabled } : mem,
			),
		);
		try {
			await MemoryService.toggle(memory.id);
		} catch {
			// Rollback
			setMemories(prevMemories);
			toast.error("Failed to toggle memory");
		}
	};

	const openCreate = () => {
		navigate("/memories/create");
	};

	const openEdit = (memory: Memory) => {
		navigate(`/memories/${encodeURIComponent(memory.id)}/edit`);
	};

	return (
		<>
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Brain className="h-5 w-5" />
							<div>
								<CardTitle>Memories</CardTitle>
								<CardDescription>
									Manage what the AI remembers about you.
								</CardDescription>
							</div>
						</div>
						<Button size="sm" onClick={openCreate}>
							<Plus className="h-4 w-4 mr-1" />
							Add Memory
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search memories..."
							value={query}
							onChange={(e) => handleSearchChange(e.target.value)}
							className="pl-9"
						/>
					</div>

					{loading ? (
						<div className="space-y-3">
							{Array.from({ length: 3 }).map((_, i) => (
								<Skeleton key={i} className="h-16 w-full rounded-md" />
							))}
						</div>
					) : memories.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							{query
								? "No memories match your search."
								: "No memories yet. Add one to get started."}
						</div>
					) : (
						<ScrollArea className="max-h-[400px]">
							<div className="space-y-2">
								{memories.map((memory) => (
									<div
										key={memory.id}
										className={`group flex items-start justify-between gap-2 rounded-md border p-3 hover:bg-muted/50 ${!memory.enabled ? "opacity-50" : ""}`}
									>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<span className="text-xs font-mono font-medium text-muted-foreground">
													{memory.id}
												</span>
											</div>
											<p className="text-sm whitespace-pre-wrap truncate">
												{memory.content}
											</p>
										</div>
										<div className="flex items-center gap-1 shrink-0">
											<Switch
												checked={memory.enabled}
												onCheckedChange={() => handleToggle(memory)}
												aria-label="Toggle memory"
											/>
											<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7"
													aria-label="Edit memory"
													onClick={() => openEdit(memory)}
												>
													<Pencil className="h-3.5 w-3.5" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7 text-destructive"
													aria-label="Delete memory"
													onClick={() => setDeleteTarget(memory)}
												>
													<Trash2 className="h-3.5 w-3.5" />
												</Button>
											</div>
										</div>
									</div>
								))}
							</div>
						</ScrollArea>
					)}

					{!loading && total > 0 && (
						<p className="text-xs text-muted-foreground text-right">
							{total} {total === 1 ? "memory" : "memories"}
						</p>
					)}
				</CardContent>
			</Card>

			<AlertDialog
				open={!!deleteTarget}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Memory</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this memory? This action cannot be
							undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
