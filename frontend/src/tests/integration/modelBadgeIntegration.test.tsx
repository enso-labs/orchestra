import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Integration tests for the model badge feature (issue #758).
 * Verifies that:
 * 1. ChatNav shows a read-only model badge, not a selector
 * 2. Settings page default model selector still works
 * 3. Agent create form model selector still works
 */

// --- ChatNav no longer has ModelBadge (moved to ChatInput) ---

describe("ChatNav model display integration", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("ChatNav source does not import SelectModel or ModelBadge (moved to ChatInput)", async () => {
		const fs = await import("node:fs");
		const path = await import("node:path");
		const source = fs.readFileSync(
			path.resolve(process.cwd(), "src/components/nav/ChatNav.tsx"),
			"utf-8",
		);
		expect(source).not.toContain("SelectModel");
		expect(source).not.toContain("ModelBadge");
	});

	it("ChatInput source imports ModelBadge", async () => {
		const fs = await import("node:fs");
		const path = await import("node:path");
		const source = fs.readFileSync(
			path.resolve(process.cwd(), "src/components/inputs/ChatInput.tsx"),
			"utf-8",
		);
		expect(source).toContain("ModelBadge");
	});

	it("ModelBadge renders correctly as a standalone component", async () => {
		const { ModelBadge } = await import("@/components/badges/ModelBadge");
		render(<ModelBadge model="openai:gpt-4o" />);

		const badge = screen.getByTestId("model-badge");
		expect(badge).toBeInTheDocument();
		expect(badge).toHaveTextContent("gpt-4o");

		// No interactive elements inside the badge itself
		expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
		expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
	});
});

// --- Settings page still has model selector ---

describe("Settings page default model selector integration", () => {
	it("DefaultModelSettings component exists and can be imported", async () => {
		// Verify the settings component still exports correctly
		const mod = await import("@/components/settings/DefaultModelSettings");
		expect(mod.DefaultModelSettings).toBeDefined();
		expect(typeof mod.DefaultModelSettings).toBe("function");
	});
});

// --- Agent create form still has SelectModel ---

describe("Agent create form model selector integration", () => {
	it("SelectModel component still exists for agent forms", async () => {
		const mod = await import("@/components/lists/SelectModel");
		expect(mod.default).toBeDefined();
		expect(typeof mod.default).toBe("function");
	});

	it("agent-create-form imports SelectModel", async () => {
		const fs = await import("node:fs");
		const path = await import("node:path");
		const source = fs.readFileSync(
			path.resolve(
				process.cwd(),
				"src/components/forms/agents/agent-create-form.tsx",
			),
			"utf-8",
		);
		expect(source).toContain("import SelectModel from");
		expect(source).toContain("<SelectModel");
	});
});

// --- NoAuthLayout no longer has model selector ---

describe("NoAuthLayout model selector removal integration", () => {
	it("NoAuthLayout does not import or render SelectModel", async () => {
		const fs = await import("node:fs");
		const path = await import("node:path");
		const source = fs.readFileSync(
			path.resolve(process.cwd(), "src/layouts/NoAuthLayout.tsx"),
			"utf-8",
		);
		expect(source).not.toContain("SelectModel");
		expect(source).not.toContain("showModelSelector");
	});
});
