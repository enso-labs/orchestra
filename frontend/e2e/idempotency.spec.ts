/**
 * Resiliency spec: Double-submit idempotency
 *
 * Sending a message twice in rapid succession (two clicks / two Enter presses
 * before the first response arrives) must produce exactly ONE assistant reply
 * bubble — not two.  Today, the frontend does not guard against this and a
 * second identical run is kicked off, so the test is annotated test.fail().
 *
 * FLIP: remove test.fail() once the double-submit guard lands.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

// Selector constants derived from verified live selectors in the briefing
const CHAT_INPUT = 'textarea[placeholder="How can I help you be more productive?"]';
const SUBMIT_BUTTON = '[data-tour="chat-submit-button"]';
// Assistant response bubble class confirmed in ChatMessages.tsx line ~194-204
const ASSISTANT_BUBBLE = "div.rounded-bl-sm";

test.describe("Double-submit idempotency", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    // Navigate to chat; adjust if the default route is different
    await page.goto("/", { waitUntil: "networkidle" });
  });

  // FLIP: remove test.fail() once the double-submit guard lands.
  test.fail(
    true,
    "Double-submit currently produces two assistant bubbles; expected one (guard not yet implemented)",
  );

  test("typing a message and submitting twice produces exactly one assistant bubble", async ({
    page,
  }) => {
    // Type a short deterministic message
    const input = page.locator(CHAT_INPUT);
    await input.fill("ping idempotency test");

    // Submit twice as fast as possible
    const submitBtn = page.locator(SUBMIT_BUTTON);
    await submitBtn.click();
    // Second click immediately — no await between them
    await submitBtn.click();

    // Wait for at least one assistant bubble to appear (the backend will reply)
    await expect(page.locator(ASSISTANT_BUBBLE).first()).toBeVisible({
      timeout: 30_000,
    });

    // Allow up to 5 s for a second bubble to materialise (it shouldn't)
    await page.waitForTimeout(5_000);

    // RESILIENT OUTCOME: exactly one assistant bubble
    const bubbles = page.locator(ASSISTANT_BUBBLE);
    await expect(bubbles).toHaveCount(1);
  });

  test("pressing Enter twice rapidly produces exactly one assistant bubble", async ({
    page,
  }) => {
    const input = page.locator(CHAT_INPUT);
    await input.fill("ping idempotency enter");

    // Two Enter presses with no gap
    await input.press("Enter");
    await input.press("Enter");

    await expect(page.locator(ASSISTANT_BUBBLE).first()).toBeVisible({
      timeout: 30_000,
    });

    await page.waitForTimeout(5_000);

    const bubbles = page.locator(ASSISTANT_BUBBLE);
    await expect(bubbles).toHaveCount(1);
  });
});
