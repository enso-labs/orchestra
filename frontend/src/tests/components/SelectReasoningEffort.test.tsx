import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "../test-utils";
import type { ModelsResponse } from "@/lib/services/modelService";

// Radix/cmdk need pointer-capture and observer APIs jsdom does not ship.
beforeEach(() => {
	Element.prototype.scrollIntoView = vi.fn();
	Element.prototype.hasPointerCapture = vi.fn(() => false);
	Element.prototype.setPointerCapture = vi.fn();
	Element.prototype.releasePointerCapture = vi.fn();
	globalThis.ResizeObserver ??= class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver;
});

const patchDefaults = vi.fn().mockResolvedValue({});
vi.mock("@/lib/services/userSettingsService", () => ({
	patchDefaults: (...args: unknown[]) => patchDefaults(...args),
}));
vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

import SelectReasoningEffort from "@/components/lists/SelectReasoningEffort";

const MODELS: ModelsResponse = {
	default: "openai:gpt-5.6-luna",
	default_reasoning_effort: null,
	free: [],
	models: ["openai:gpt-5.6-luna", "openai:gpt-4.1-mini"],
	reasoning: {
		"openai:gpt-5.6-luna": ["none", "low", "medium", "high", "xhigh", "max"],
		"openai:o3": ["low", "medium", "high"],
	},
};

type Props = Parameters<typeof SelectReasoningEffort>[0];

function renderPicker(props: Partial<Props> = {}) {
	const Wrapper = createQueryWrapper();
	return render(
		<Wrapper>
			<SelectReasoningEffort
				model="openai:gpt-5.6-luna"
				models={MODELS}
				{...props}
			/>
		</Wrapper>,
	);
}

const openPicker = async () => {
	fireEvent.click(screen.getByTestId("reasoning-effort-selector"));
	return screen.findAllByRole("option");
};

describe("SelectReasoningEffort", () => {
	beforeEach(() => {
		patchDefaults.mockClear();
	});

	describe("visibility", () => {
		it("renders nothing for a model that takes no reasoning effort", () => {
			renderPicker({ model: "openai:gpt-4.1-mini" });
			expect(screen.queryByTestId("reasoning-effort-selector")).toBeNull();
		});

		it("renders nothing when no model is selected", () => {
			renderPicker({ model: null });
			expect(screen.queryByTestId("reasoning-effort-selector")).toBeNull();
		});

		it("renders nothing when the payload carries no reasoning map", () => {
			renderPicker({ models: { ...MODELS, reasoning: undefined } });
			expect(screen.queryByTestId("reasoning-effort-selector")).toBeNull();
		});
	});

	describe("current value", () => {
		it("shows 'auto' when no effort is saved", () => {
			renderPicker();
			expect(screen.getByTestId("reasoning-effort-selector")).toHaveTextContent(
				"auto",
			);
		});

		it("shows the saved effort", () => {
			renderPicker({
				models: { ...MODELS, default_reasoning_effort: "xhigh" },
			});
			expect(screen.getByTestId("reasoning-effort-selector")).toHaveTextContent(
				"xhigh",
			);
		});

		it("falls back to 'auto' when the saved effort is invalid for this model", () => {
			// "xhigh" is saved but o3 stops at "high". The server drops it, so the
			// badge must not claim it is in force.
			renderPicker({
				model: "openai:o3",
				models: { ...MODELS, default_reasoning_effort: "xhigh" },
			});
			expect(screen.getByTestId("reasoning-effort-selector")).toHaveTextContent(
				"auto",
			);
		});
	});

	describe("options", () => {
		it("offers exactly the values the model supports, plus auto", async () => {
			renderPicker({ model: "openai:o3" });
			const options = await openPicker();
			expect(options.map((o) => o.textContent)).toEqual([
				"auto",
				"low",
				"medium",
				"high",
			]);
		});

		it("offers the wider set for a model that supports more", async () => {
			renderPicker();
			const options = await openPicker();
			expect(options.map((o) => o.textContent)).toEqual([
				"auto",
				"none",
				"low",
				"medium",
				"high",
				"xhigh",
				"max",
			]);
		});
	});

	describe("saving", () => {
		it("saves the picked effort as a user default", async () => {
			renderPicker();
			const options = await openPicker();
			fireEvent.click(options.find((o) => o.textContent === "high")!);

			await waitFor(() =>
				expect(patchDefaults).toHaveBeenCalledWith({
					reasoning_effort: "high",
				}),
			);
		});

		it("clears the default when auto is picked", async () => {
			renderPicker({ models: { ...MODELS, default_reasoning_effort: "high" } });
			const options = await openPicker();
			fireEvent.click(options.find((o) => o.textContent === "auto")!);

			await waitFor(() =>
				expect(patchDefaults).toHaveBeenCalledWith({ reasoning_effort: null }),
			);
		});

		it("does not save when the picked effort is already in force", async () => {
			renderPicker({ models: { ...MODELS, default_reasoning_effort: "high" } });
			const options = await openPicker();
			fireEvent.click(options.find((o) => o.textContent === "high")!);

			await waitFor(() => expect(screen.queryByRole("option")).toBeNull());
			expect(patchDefaults).not.toHaveBeenCalled();
		});
	});
});
