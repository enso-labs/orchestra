import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryParamProvider } from "use-query-params";
import { ReactRouter6Adapter } from "use-query-params/adapters/react-router-6";
import App from "../App";

// Routes
import PrivateRoute from "./PrivateRoute";
import PublicRoute from "./PublicRoute";

// Pages
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import Chat from "@/pages/Chat";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import OAuthCallback from "@/pages/OAuthCallback";
import AgentCreatePage from "@/pages/agents/create";
import AgentIndexPage from "@/pages/agents";
import AgentEditPage from "@/pages/agents/edit";
import SchedulesIndexPage from "@/pages/schedules";
import PromptsIndexPage from "@/pages/prompts";
import PromptCreatePage from "@/pages/prompts/create";
import PromptEditPage from "@/pages/prompts/edit";

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
									<Home />
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

					{/* Private Routes */}
					<Route
						path="/chat"
						element={
							<PrivateRoute>
								<Chat />
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
						path="/a/:agentId"
						element={
							<PrivateRoute>
								<AgentEditPage />
							</PrivateRoute>
						}
					/>
					<Route
						path="/a/create"
						element={
							<PrivateRoute>
								<AgentCreatePage />
							</PrivateRoute>
						}
					/>
					<Route
						path="/schedules"
						element={
							<PrivateRoute>
								<SchedulesIndexPage />
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
					<Route path="*" element={<NotFound />} />
				</Routes>
			</QueryParamProvider>
		</Router>
	);
};

export default AppRoutes;
