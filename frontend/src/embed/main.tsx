import React from "react";
import { createRoot } from "react-dom/client";
import { EmbedWidget } from "./EmbedWidget";

interface EmbedConfig {
	agentId: string;
	apiBase: string;
	token?: string;
}

function getScriptConfig(): EmbedConfig | null {
	const script =
		document.currentScript ??
		document.querySelector<HTMLScriptElement>("script[data-agent-id]");
	if (!script) return null;

	const agentId = script.getAttribute("data-agent-id");
	if (!agentId) return null;

	// Default apiBase to the origin of the embed script URL (not the host page)
	let defaultBase = window.location.origin;
	try {
		if (script instanceof HTMLScriptElement && script.src) {
			defaultBase = new URL(script.src).origin;
		}
	} catch {
		// fall back to window.location.origin
	}
	const apiBase = script.getAttribute("data-api-base") ?? defaultBase;
	const token = script.getAttribute("data-token") ?? undefined;

	return { agentId, apiBase, token };
}

function init(config?: Partial<EmbedConfig>) {
	const scriptConfig = getScriptConfig();
	const merged: EmbedConfig = {
		agentId: config?.agentId ?? scriptConfig?.agentId ?? "",
		apiBase: config?.apiBase ?? scriptConfig?.apiBase ?? window.location.origin,
		token: config?.token ?? scriptConfig?.token,
	};

	if (!merged.agentId) {
		console.error("[Orchestra Embed] Missing data-agent-id attribute");
		return;
	}

	const container = document.createElement("div");
	container.id = "orchestra-embed-root";
	document.body.appendChild(container);

	// Use shadow DOM for style isolation — host page CSS won't affect the widget
	const shadow = container.attachShadow({ mode: "open" });
	const mountPoint = document.createElement("div");
	shadow.appendChild(mountPoint);

	const root = createRoot(mountPoint);
	root.render(
		<React.StrictMode>
			<EmbedWidget
				agentId={merged.agentId}
				apiBase={merged.apiBase}
				token={merged.token}
			/>
		</React.StrictMode>,
	);
}

// Auto-init when loaded via script tag
if (typeof document !== "undefined") {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => init());
	} else {
		init();
	}
}

// Expose for programmatic use
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).OrchestraEmbed = { init };
