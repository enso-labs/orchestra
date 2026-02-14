import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
	Plus,
	Search,
	Sparkles,
	Pencil,
	Trash2,
	Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSkillContext } from "@/context/SkillContext";
import { Skill } from "@/lib/entities/skill";
import SkillService from "@/lib/services/skillService";
import ChatLayout from "@/layouts/chat-layout-v2";
import { ChatNav } from "@/components/nav/ChatNav";
import { SidebarTrigger } from "@/components/ui/sidebar";

function SkillsIndexPage() {
	const navigate = useNavigate();
	const { skills, isLoadingSkills, useEffectGetSkills, handleGetSkills } =
		useSkillContext();
	const [searchQuery, setSearchQuery] = useState("");

	useEffectGetSkills();

	const filteredSkills = useMemo(() => {
		if (!searchQuery.trim()) return skills;
		const q = searchQuery.toLowerCase();
		return skills.filter(
			(skill: Skill) =>
				skill.name.toLowerCase().includes(q) ||
				skill.description.toLowerCase().includes(q),
		);
	}, [skills, searchQuery]);

	const handleToggle = async (name: string) => {
		try {
			await SkillService.toggle(name);
			await handleGetSkills();
		} catch (error) {
			console.error("Failed to toggle skill:", error);
		}
	};

	const handleDelete = async (name: string) => {
		try {
			await SkillService.delete(name);
			await handleGetSkills();
		} catch (error) {
			console.error("Failed to delete skill:", error);
		}
	};

	const getResultsSummary = () => {
		if (isLoadingSkills) return "Loading skills...";
		return filteredSkills.length === skills.length
			? `Showing all ${filteredSkills.length} skills`
			: `Found ${filteredSkills.length} skills matching "${searchQuery}"`;
	};

	return (
		<ChatLayout>
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
				<ChatNav sidebarTrigger={<SidebarTrigger />} />
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					{/* Fixed header section */}
					<div className="flex-shrink-0 px-4 pt-4">
						<div className="mx-auto">
							<div className="mb-5">
								<div className="flex items-center justify-between mb-2">
									<h1 className="text-3xl font-bold text-foreground">
										Skills
									</h1>
									<Button
										variant="outline"
										onClick={() => navigate("/skills/create")}
									>
										<Plus className="h-4 w-4 mr-2" />
										Create Skill
									</Button>
								</div>
								<p className="text-muted-foreground mb-6">
									Manage reusable agent skills that enhance your AI
									assistants
								</p>

								<div className="flex items-center gap-4">
									<div className="relative max-w-md flex-1">
										<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
										<Input
											type="text"
											placeholder="Search skills by name or description..."
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											className="pl-10"
										/>
									</div>
									<p className="text-sm text-muted-foreground">
										{getResultsSummary()}
									</p>
								</div>
							</div>
						</div>
					</div>

					{/* Skills list */}
					<div className="flex-1 min-h-0 px-4 pb-4">
						<ScrollArea className="h-full">
							<div className="pb-4">
								{isLoadingSkills ? (
									<div className="flex items-center justify-center py-12">
										<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
										<span className="ml-3 text-muted-foreground">
											Loading skills...
										</span>
									</div>
								) : filteredSkills.length > 0 ? (
									<div className="space-y-2">
										{filteredSkills.map((skill: Skill) => (
											<div
												key={skill.name}
												className="flex items-center justify-between p-4 border rounded-lg hover:shadow-sm transition-shadow"
											>
												<div className="flex-1 min-w-0 mr-4">
													<div className="flex items-center gap-2 mb-1">
														<span className="font-medium text-foreground">
															{skill.name}
														</span>
														{skill.tags.map((tag) => (
															<Badge
																key={tag}
																variant="secondary"
																className="text-xs"
															>
																{tag}
															</Badge>
														))}
													</div>
													<p className="text-sm text-muted-foreground truncate">
														{skill.description}
													</p>
												</div>

												<div className="flex items-center gap-3 flex-shrink-0">
													<Switch
														checked={!skill.disabled}
														onCheckedChange={() =>
															handleToggle(skill.name)
														}
													/>
													<Button
														variant="ghost"
														size="icon"
														onClick={() =>
															navigate(
																`/skills/${skill.name}/edit`,
															)
														}
													>
														<Pencil className="h-4 w-4" />
													</Button>
													<AlertDialog>
														<AlertDialogTrigger asChild>
															<Button
																variant="ghost"
																size="icon"
															>
																<Trash2 className="h-4 w-4 text-destructive" />
															</Button>
														</AlertDialogTrigger>
														<AlertDialogContent>
															<AlertDialogHeader>
																<AlertDialogTitle>
																	Delete skill
																</AlertDialogTitle>
																<AlertDialogDescription>
																	Are you sure you want to
																	delete &quot;{skill.name}
																	&quot;? This action cannot
																	be undone.
																</AlertDialogDescription>
															</AlertDialogHeader>
															<AlertDialogFooter>
																<AlertDialogCancel>
																	Cancel
																</AlertDialogCancel>
																<AlertDialogAction
																	onClick={() =>
																		handleDelete(
																			skill.name,
																		)
																	}
																>
																	Delete
																</AlertDialogAction>
															</AlertDialogFooter>
														</AlertDialogContent>
													</AlertDialog>
												</div>
											</div>
										))}
									</div>
								) : (
									<div className="text-center py-12">
										<Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
										<h3 className="text-lg font-semibold text-foreground mb-2">
											No skills found
										</h3>
										<p className="text-muted-foreground mb-4">
											{searchQuery
												? `No skills match your search for "${searchQuery}"`
												: "You haven't created any skills yet"}
										</p>
										{searchQuery ? (
											<Button
												variant="outline"
												onClick={() => setSearchQuery("")}
											>
												Clear search
											</Button>
										) : (
											<Button
												onClick={() =>
													navigate("/skills/create")
												}
											>
												<Plus className="h-4 w-4 mr-2" />
												Create your first skill
											</Button>
										)}
									</div>
								)}
							</div>
						</ScrollArea>
					</div>
				</div>
			</div>
		</ChatLayout>
	);
}

export default SkillsIndexPage;
