/**
 * Blocking browser contract: Aegra run failures remain observable and carry
 * the run identifier used for support diagnostics.
 */

import { test, expect, Page, Locator } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";
import { chatInput, chatSubmitButton, waitForChatInput } from "./helpers/chat";

const RUN_ID = "00000000-0000-4000-8000-000000000001";
const CORRELATION_ID_PATTERN = /[0-9a-f-]{8,}/i;

function anyOf(page: Page, selectors: string[]): Locator {
	return selectors
		.map((selector) => page.locator(selector))
		.reduce((acc, locator) => acc.or(locator));
}

test.describe("Aegra run error surface", () => {
	test.beforeEach(async ({ page }) => {
		await loginAsAdmin(page);
		await page.route("**/threads/**/runs/stream", async (route) => {
			await route.fulfill({
				status: 200,
				headers: { "content-type": "text/event-stream" },
				body: [
					`id: ${RUN_ID}`,
					"event: error",
					`data: {"run_id":"${RUN_ID}","message":"provider unavailable"}`,
					"",
					"",
				].join("\n"),
			});
		});
		await page.goto("/chat", { waitUntil: "domcontentloaded" });
		await waitForChatInput(page);
	});

	test("a terminal run failure exposes an accessible labelled run ID", async ({
		page,
	}) => {
		const input = chatInput(page);
		await input.fill("trigger a deterministic provider error");
		await chatSubmitButton(page).click();

		const error = anyOf(page, [
			"[data-testid='message-error']",
			"[role='alert']",
		]);
		await expect(error.first()).toBeVisible({ timeout: 30_000 });

		const correlationId = anyOf(page, [
			"[data-correlation-id]",
			"[data-testid='correlation-id']",
		]);
		await expect(correlationId.first()).toBeVisible({ timeout: 10_000 });
		const idValue =
			(await correlationId.first().getAttribute("data-correlation-id")) ??
			(await correlationId.first().textContent());
		expect(idValue ?? "").toMatch(CORRELATION_ID_PATTERN);
	});
});
