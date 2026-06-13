import "./styles/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRoutes } from "./routes";
import ChatProvider from "./context/ChatContext";
import AgentProvider from "./context/AgentContext";
import ProjectProvider from "./context/ProjectContext";
import ThemeProvider from "./context/ThemeContext";
import AppProvider from "./context/AppContext";
import BrandingProvider from "./context/BrandingContext";
import { PromptProvider } from "./context/PromptContext";
import { OnboardingProvider } from "./context/OnboardingContext";
import { NuqsAdapter } from "nuqs/adapters/react";
import { QueryProvider } from "./providers/QueryProvider";

// Register service worker
if ("serviceWorker" in navigator && import.meta.env.MODE === "production") {
	navigator.serviceWorker
		.register(
			import.meta.env.MODE === "production" ? "/sw.js" : "/dev-sw.js?dev-sw",
			{ type: import.meta.env.MODE === "production" ? "classic" : "module" },
		)
		.then((registration) => {
			console.log("Service worker registered successfully:", registration);
		})
		.catch((error) => {
			console.error("Service worker registration failed:", error);
		});
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
			<QueryProvider>
				<NuqsAdapter>
					<BrandingProvider>
						<AppProvider>
							<AgentProvider>
								<ProjectProvider>
									<PromptProvider>
										<ChatProvider>
											<OnboardingProvider>
												<AppRoutes />
											</OnboardingProvider>
										</ChatProvider>
									</PromptProvider>
								</ProjectProvider>
							</AgentProvider>
						</AppProvider>
					</BrandingProvider>
				</NuqsAdapter>
			</QueryProvider>
		</ThemeProvider>
	</StrictMode>,
);
