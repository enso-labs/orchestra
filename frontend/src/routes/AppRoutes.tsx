import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryParamProvider } from "use-query-params";
import { ReactRouter6Adapter } from "use-query-params/adapters/react-router-6";
import App from "../App";

// Routes
import PrivateRoute from "./PrivateRoute";
import PublicRoute from "./PublicRoute";

// Pages
import NotFound from "@/pages/NotFound";
// import Chat from "@/pages/Chat";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import OAuthCallback from "@/pages/OAuthCallback";
import AgentCreatePage from "@/pages/agents/create";
import AgentIndexPage from "@/pages/agents";
import AgentEditPage from "@/pages/agents/edit";
import PublicAgentPage from "@/pages/agents/public";
import SharedThreadPage from "@/pages/share/SharedThreadPage";
import PromptsIndexPage from "@/pages/prompts";
import PromptCreatePage from "@/pages/prompts/create";
import PromptEditPage from "@/pages/prompts/edit";
import ChatV2Page from "@/pages/chat/chat-v2";
import ProjectPage from "@/pages/projects/ProjectPage";
import ThreadPage from "@/pages/threads/ThreadPage";
import AgentThreadPage from "@/pages/agents/thread";
import SettingsPage from "@/pages/settings";
import MemoryEditPage from "@/pages/memories/edit";
import MemoryCreatePage from "@/pages/memories/create";
import MemoriesIndexPage from "@/pages/memories";

const AppRoutes: React.FC = () => {
	return (
		<Router>
			<QueryParamProvider adapter={ReactRouter6Adapter}>
				<Routes>
					{/* Public Routes */}
					<Route path="/" element={<App />}>
						<Route
							index
							element={
								<PublicRoute>
									<Login />
								</PublicRoute>
							}
						/>
						<Route
							path="login"
							element={
								<PublicRoute>
									<Login />
								</PublicRoute>
							}
						/>
						<Route
							path="register"
							element={
								<PublicRoute>
									<Register />
								</PublicRoute>
							}
						/>
						<Route path="auth/:provider/callback" element={<OAuthCallback />} />
						<Route path="*" element={<NotFound />} />
					</Route>

					{/* Public Agent Route - accessible without auth */}
					<Route path="/a/:agentId" element={<PublicAgentPage />} />

					{/* Public Share Route - accessible without auth */}
					<Route path="/share/:shareToken" element={<SharedThreadPage />} />

					{/* Private Routes */}
					<Route
						path="/chat"
						element={
							<PrivateRoute>
								<ChatV2Page />
							</PrivateRoute>
						}
					/>
					<Route
						path="/assistants"
						element={
							<PrivateRoute>
								<AgentIndexPage />
							</PrivateRoute>
						}
					/>
					<Route
						path="/assistant/:agentId"
						element={
							<PrivateRoute>
								<AgentEditPage />
							</PrivateRoute>
						}
					/>
					<Route
						path="/assistant/:agentId/thread/:threadId"
						element={
							<PrivateRoute>
								<AgentThreadPage />
							</PrivateRoute>
						}
					/>
					<Route
						path="/assistant/create"
						element={
							<PrivateRoute>
								<AgentCreatePage />
							</PrivateRoute>
						}
					/>
					<Route
						path="/prompts"
						element={
							<PrivateRoute>
								<PromptsIndexPage />
							</PrivateRoute>
						}
					/>
					<Route
						path="/prompts/create"
						element={
							<PrivateRoute>
								<PromptCreatePage />
							</PrivateRoute>
						}
					/>
					<Route
						path="/prompts/:promptId/edit"
						element={
							<PrivateRoute>
								<PromptEditPage />
							</PrivateRoute>
						}
					/>
					<Route
						path="/p/:projectId"
						element={
							<PrivateRoute>
								<ProjectPage />
							</PrivateRoute>
						}
					/>
					<Route
						path="/p/:projectId/t/:threadId"
						element={
							<PrivateRoute>
								<ThreadPage />
							</PrivateRoute>
						}
					/>
					<Route
						path="/thread/:threadId"
						element={
							<PrivateRoute>
								<ThreadPage />
							</PrivateRoute>
						}
					/>
					<Route
						path="/settings"
						element={
							<PrivateRoute>
								<SettingsPage />
							</PrivateRoute>
						}
					/>
					<Route
						path="/memories"
						element={
							<PrivateRoute>
								<MemoriesIndexPage />
							</PrivateRoute>
						}
					/>
					<Route
						path="/memories/create"
						element={
							<PrivateRoute>
								<MemoryCreatePage />
							</PrivateRoute>
						}
					/>
					<Route
						path="/memories/:memoryId/edit"
						element={
							<PrivateRoute>
								<MemoryEditPage />
							</PrivateRoute>
						}
					/>
					<Route path="*" element={<NotFound />} />
				</Routes>
			</QueryParamProvider>
		</Router>
	);
};

export default AppRoutes;
