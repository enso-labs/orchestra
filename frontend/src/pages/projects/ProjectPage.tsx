import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChatLayout from "@/layouts/chat-layout-v2";
import { useChatContext } from "@/context/ChatContext";
import { ChatNav } from "@/components/nav/ChatNav";
import ChatInput from "@/components/inputs/ChatInput";
import ChatMessages from "@/components/lists/ChatMessages";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/context/AppContext";
import { useAgentContext } from "@/context/AgentContext";
import ProjectSection from "@/components/sections/project-section";
import ListProjectThreads from "@/components/lists/ListProjectThreads";
import ProjectService from "@/lib/services/projectService";
import { Project } from "@/lib/entities/project";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/ui/resizable";
import FileEditorPanel from "@/components/panels/FileEditorPanel";

export default function ProjectPage() {
	const { projectId } = useParams<{ projectId: string }>();
	const navigate = useNavigate();
	const { loading, appVersion } = useAppContext();
	const { useEffectGetAgents } = useAgentContext();
	const {
		messages,
		metadata,
		setMetadata,
		useEffectUpdateAssistantId,
		useListThreadsEffect,
		useListCheckpointsEffect,
		useModelsEffect,
		viewMode,
		filesMap,
	} = useChatContext();

	const [project, setProject] = useState<Project | null>(null);
	const [projectLoading, setProjectLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useModelsEffect();
	useEffectGetAgents();
	useEffectUpdateAssistantId();
	useListThreadsEffect(!loading);
	useListCheckpointsEffect(!loading, metadata);

	// Fetch project data
	useEffect(() => {
		const fetchProject = async () => {
			if (!projectId) return;
			setProjectLoading(true);
			setError(null);
			try {
				const response = await ProjectService.get(projectId);
				setProject(response.data.project);
			} catch (err) {
				console.error("Failed to fetch project:", err);
				setError("Project not found");
			} finally {
				setProjectLoading(false);
			}
		};

		fetchProject();
	}, [projectId]);

	// Set project_id in metadata when page mounts
	useEffect(() => {
		if (projectId) {
			setMetadata((prev: any) => ({
				...prev,
				project_id: projectId,
			}));
		}

		return () => {
			setMetadata((prev: any) => {
				const { project_id, ...rest } = prev;
				return rest;
			});
		};
	}, [projectId, setMetadata]);

	if (projectLoading) {
		return (
			<ChatLayout>
				<div className="flex h-full items-center justify-center">
					<p className="text-muted-foreground">Loading project...</p>
				</div>
			</ChatLayout>
		);
	}

	if (error || !project) {
		return (
			<ChatLayout>
				<div className="flex h-full flex-col items-center justify-center gap-4">
					<p className="text-muted-foreground">{error || "Project not found"}</p>
					<Button onClick={() => navigate("/chat")}>Go to Chat</Button>
				</div>
			</ChatLayout>
		);
	}

	// Show project view when no messages
	if (messages.length === 0) {
		return (
			<ChatLayout>
				<ChatNav sidebarTrigger={<SidebarTrigger />} />
				<div className="flex-1 flex flex-col items-center justify-center bg-background p-6 overflow-y-auto">
					<ProjectSection project={project} showAgentMenu={true} />

					{/* Project Threads Section */}
					<div className="w-full max-w-2xl mt-8">
						<h2 className="text-lg font-semibold mb-4">Recent Conversations</h2>
						<ListProjectThreads projectId={projectId!} />
					</div>
				</div>
				<footer className="mt-auto bg-card">
					<div className="px-4 sm:px-6 lg:px-8 py-4">
						<p className="text-center text-muted-foreground text-xs">
							&copy; 2025 Ensō Labs. All rights reserved. v{appVersion}
						</p>
					</div>
				</footer>
			</ChatLayout>
		);
	}

	// Show chat view when there are messages
	return (
		<ChatLayout>
			<div className="flex h-full relative">
				{viewMode === "chat" ? (
					<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
						<ChatNav sidebarTrigger={<SidebarTrigger />} />
						<div className="flex-1 min-h-0">
							<ChatMessages messages={messages} />
						</div>
						<div className="sticky bottom-0 bg-background border-border">
							<div className="max-w-4xl mx-auto">
								<div className="flex flex-col gap-2 px-4 pb-4">
									<ChatInput showAgentMenu={true} />
								</div>
							</div>
						</div>
					</div>
				) : (
					<ResizablePanelGroup direction="horizontal" className="flex-1">
						<ResizablePanel
							defaultSize={60}
							minSize={50}
							maxSize={80}
							className="hidden md:block"
						>
							<FileEditorPanel filesMap={filesMap} />
						</ResizablePanel>

						<ResizableHandle withHandle className="hidden md:flex" />

						<ResizablePanel defaultSize={40} minSize={20} maxSize={50}>
							<div className="flex flex-col h-full min-h-0 overflow-hidden">
								<ChatNav sidebarTrigger={<SidebarTrigger />} />
								<div className="flex-1 min-h-0">
									<ChatMessages messages={messages} />
								</div>
								<div className="sticky bottom-0 bg-background border-border">
									<div className="max-w-4xl mx-auto">
										<div className="flex flex-col gap-2 px-4 pb-4">
											<ChatInput showAgentMenu={true} />
										</div>
									</div>
								</div>
							</div>
						</ResizablePanel>
					</ResizablePanelGroup>
				)}
			</div>
		</ChatLayout>
	);
}
