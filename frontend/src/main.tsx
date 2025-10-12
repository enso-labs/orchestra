import "./styles/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRoutes } from "./routes";
import ChatProvider from "./context/ChatContext";
import AgentProvider from "./context/AgentContext";
import ThemeProvider from "./context/ThemeContext";
import AppProvider from "./context/AppContext";
import { IntroProvider } from "@/contexts/IntroContext";
import "@/styles/intro-theme.css";

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
			<AppProvider>
				<IntroProvider>
					<AgentProvider>
						<ChatProvider>
							<AppRoutes />
						</ChatProvider>
					</AgentProvider>
				</IntroProvider>
			</AppProvider>
		</ThemeProvider>
	</StrictMode>,
);
