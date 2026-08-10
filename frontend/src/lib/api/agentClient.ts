import { Client, type RequestHook } from "@langchain/langgraph-sdk";
import { getAuthToken } from "@/lib/utils/auth";
import type { Agent } from "@/lib/services/agentService";

/** The only graph registered by the production Aegra runtime. */
export const PRODUCTION_GRAPH_ID = "orchestra";

/**
 * Aegra creates one deterministic assistant for the production graph.  The
 * Orchestra assistant selected in the UI is carried in the run context and is
 * never treated as an unscoped Agent Protocol assistant.
 */
export const PRODUCTION_ASSISTANT_ID = "cc8e8916-8ce2-52ff-b440-51cd1c937b5d";

export const AGENT_STREAM_MODES = [
	"messages-tuple",
	"values",
	"custom",
] as const;

export type AgentStreamMode = (typeof AGENT_STREAM_MODES)[number];

export type AssistantRunMapping = {
	assistantId: string;
	graphId: typeof PRODUCTION_GRAPH_ID;
	context: Record<string, unknown>;
	config: { configurable: Record<string, unknown> };
	metadata: Record<string, unknown>;
};

export type AdaptedAgentEvent = {
	type: "metadata" | "messages" | "values" | "custom" | "error";
	data: unknown;
	id?: string;
	/** The namespace suffix emitted by Aegra for a subgraph event. */
	subgraph?: string;
};

type SdkStreamEvent = {
	id?: unknown;
	event: string;
	data: unknown;
};

const AGENT_API_FALLBACK = "http://localhost:8000";
const PROTOCOL_METADATA_KEY = /^[A-Za-z0-9_-]{1,64}$/;
const PROTOCOL_METADATA_MAX_VALUE_LENGTH = 512;

/**
 * Agent Protocol is mounted at the origin root in production.  The optional
 * explicit URL is useful for local development against a separately running
 * API, while the deployed default can never accidentally point at `/api`.
 */
export function getAgentApiUrl(): string {
	const configured = import.meta.env.VITE_AGENT_API_URL;
	if (configured) return configured.replace(/\/$/, "");
	if (typeof window !== "undefined") return window.location.origin;
	return AGENT_API_FALLBACK;
}

/**
 * Attach credentials at request time rather than at client construction time.
 * Login/logout and token rotation therefore apply to already-created clients.
 */
export const attachCurrentAuth: RequestHook = (_url, init) => {
	const headers = new Headers(init.headers);
	const token = getAuthToken();
	if (token) {
		headers.set("Authorization", `Bearer ${token}`);
	} else {
		headers.delete("Authorization");
	}
	return { ...init, headers };
};

export function createAgentClient(): Client {
	return new Client({
		apiUrl: getAgentApiUrl(),
		apiKey: null,
		onRequest: attachCurrentAuth,
	});
}

/** The sole SDK client used by frontend graph, run, thread, and store code. */
export const agentClient = createAgentClient();

function withoutTenantIdentity(
	value: Record<string, unknown>,
): Record<string, unknown> {
	const copy = { ...value };
	delete copy.user_id;
	return copy;
}

/**
 * Aegra metadata is trace/filter metadata, not a payload container.  Keep only
 * the primitive values accepted by the Agent Protocol and leave assistant
 * configuration in `context`, where arrays, objects, and nulls are valid.
 */
function toProtocolMetadata(
	value: Record<string, unknown>,
): Record<string, string | number | boolean> {
	const result: Record<string, string | number | boolean> = {};
	for (const [key, candidate] of Object.entries(withoutTenantIdentity(value))) {
		if (!PROTOCOL_METADATA_KEY.test(key) || candidate == null) continue;
		if (
			typeof candidate === "string" &&
			candidate.length <= PROTOCOL_METADATA_MAX_VALUE_LENGTH
		) {
			result[key] = candidate;
		} else if (typeof candidate === "number" && Number.isFinite(candidate)) {
			result[key] = candidate;
		} else if (typeof candidate === "boolean") {
			result[key] = candidate;
		}
	}
	return result;
}

/**
 * Map a canonical Orchestra assistant to the one production Aegra graph.
 * Assistant settings remain in authenticated context; only the production
 * graph assistant ID is sent as the SDK's assistant argument.
 */
export function mapAssistantToProductionGraph(
	agent: Partial<Agent> & Record<string, unknown>,
	metadata: Record<string, unknown> = {},
): AssistantRunMapping {
	const assistantId = typeof agent.id === "string" ? agent.id : null;
	const assistantMetadata =
		agent.metadata && typeof agent.metadata === "object"
			? (agent.metadata as Record<string, unknown>)
			: {};
	const context = withoutTenantIdentity({
		assistant_id: assistantId,
		model: agent.model,
		system_prompt: agent.system_prompt ?? agent.prompt,
		instructions: agent.instructions,
		tools: agent.tools ?? [],
		subagents: agent.subagents ?? [],
		mcp: agent.mcp ?? {},
		a2a: agent.a2a ?? {},
		files: agent.files ?? {},
		metadata: assistantMetadata,
		project_id: metadata.project_id ?? assistantMetadata.project_id ?? null,
	});
	const protocolMetadata = toProtocolMetadata({
		...metadata,
		assistant_id: assistantId,
		orchestra_assistant_id: assistantId,
		graph_id: PRODUCTION_GRAPH_ID,
	});

	return {
		assistantId: PRODUCTION_ASSISTANT_ID,
		graphId: PRODUCTION_GRAPH_ID,
		context,
		config: { configurable: { ...context } },
		metadata: protocolMetadata,
	};
}

/**
 * SDK stream events have one of the requested mode names (or a `|namespace`
 * suffix when subgraphs are enabled).  Normalize only that protocol boundary;
 * the chat reducer continues to consume its existing mode/data contract.
 */
export function adaptEvent(event: SdkStreamEvent): AdaptedAgentEvent | null {
	if (!event || typeof event.event !== "string") return null;

	const [mode, ...namespace] = event.event.split("|");
	const subgraph = namespace.length > 0 ? namespace.join("|") : undefined;
	const base = {
		...(typeof event.id === "string" ? { id: event.id } : {}),
		...(subgraph ? { subgraph } : {}),
	};

	switch (mode) {
		case "metadata":
			return { ...base, type: "metadata", data: event.data };
		case "messages": {
			if (!Array.isArray(event.data) || event.data.length < 2) return null;
			const [message, tupleMetadata] = event.data as [unknown, unknown];
			const normalizedMessage = normalizeMessage(
				message,
				tupleMetadata,
				subgraph,
			);
			return {
				...base,
				type: "messages",
				data: [normalizedMessage, tupleMetadata ?? {}],
			};
		}
		case "values":
			return { ...base, type: "values", data: event.data };
		case "custom":
			return { ...base, type: "custom", data: event.data };
		case "error":
			return { ...base, type: "error", data: normalizeError(event.data) };
		default:
			// Unknown protocol events must not be mistaken for reducer input.
			return null;
	}
}

function normalizeMessage(
	message: unknown,
	tupleMetadata: unknown,
	subgraph?: string,
): Record<string, unknown> {
	if (!message || typeof message !== "object") {
		return { id: undefined, type: "ai", content: "" };
	}

	const normalized = { ...(message as Record<string, unknown>) };
	const type =
		typeof normalized.type === "string" ? normalized.type.toLowerCase() : "";
	if (type.includes("human") || type === "user") normalized.type = "human";
	else if (type.includes("tool")) normalized.type = "tool";
	else if (type.includes("system")) normalized.type = "system";
	else if (type.includes("ai") || type.includes("assistant"))
		normalized.type = "ai";

	const metadata =
		tupleMetadata && typeof tupleMetadata === "object"
			? (tupleMetadata as Record<string, unknown>)
			: {};
	const agentName =
		normalized.agent_name ?? metadata.agent_name ?? metadata.lc_agent_name;
	if (agentName !== undefined) normalized.agent_name = agentName;
	if (subgraph) normalized.subgraph = subgraph;
	return normalized;
}

function normalizeError(data: unknown): Record<string, unknown> {
	if (typeof data === "string") return { error: data, message: data };
	if (data && typeof data === "object") {
		const error = data as Record<string, unknown>;
		return {
			...error,
			error: String(error.error ?? error.message ?? "The run failed."),
			message: String(error.message ?? error.error ?? "The run failed."),
		};
	}
	return { error: "The run failed.", message: "The run failed." };
}

/** Map SDK/HTTP failures to copy safe for an inline accessible error state. */
export function describeAgentError(error: unknown): {
	message: string;
	status?: number;
} {
	const candidate = error as {
		status?: number;
		message?: string;
		name?: string;
	};
	const status =
		typeof candidate?.status === "number" ? candidate.status : undefined;
	if (status === 401)
		return {
			status,
			message: "Your session has expired. Sign in again to continue.",
		};
	if (status === 403)
		return {
			status,
			message: "You do not have access to this assistant or thread.",
		};
	if (status === 429)
		return {
			status,
			message: "Too many requests. Wait a moment and try again.",
		};
	if (status === 408 || candidate?.name === "TimeoutError") {
		return {
			status,
			message: "The request timed out. Your partial response is still here.",
		};
	}
	if (candidate?.name === "AbortError" || candidate?.message === "AbortError") {
		return { status, message: "The request was stopped." };
	}
	if (typeof candidate?.message === "string" && candidate.message.trim()) {
		return { status, message: candidate.message };
	}
	return {
		status,
		message: "The request failed. Try sending your message again.",
	};
}
