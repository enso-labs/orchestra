/**
 * Resiliency spec: Dead-letter queue (DLQ) replay affordance
 *
 * When a message hits a permanent processing failure (e.g., an intentionally
 * malformed payload or a model that rejects the request outright), the UI must:
 *   1. NOT silently hang — it must surface a failed/error state.
 *   2. Offer a replay / retry affordance (button, link, or actionable text) so
 *      the user can recover without refreshing.
 *
 * Today, failed runs may leave the UI in a loading/hanging state with no replay
 * option, so this test is annotated test.fail().
 *
 * FLIP: remove test.fail() once DLQ replay affordance lands.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

const CHAT_INPUT = 'textarea[placeholder="How can I help you be more productive?"]';
const SUBMIT_BUTTON = '[data-tour="chat-submit-button"]';

// Selectors for expected error / replay UI (to be confirmed once feature lands)
// These are intentionally flexible — match any visible error region or retry CTA.
const ERROR_STATE_SELECTORS = [
  "[data-testid='message-error']",
  "[data-testid='replay-button']",
  "button:has-text('Retry')",
  "button:has-text('Replay')",
  "[role='alert']",
  "text=failed",
  "text=error",
];

test.describe("DLQ replay affordance", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/", { waitUntil: "networkidle" });
  });

  // FLIP: remove test.fail() once DLQ replay affordance lands.
  test.fail(
    true,
    "Permanent failure currently leaves UI in a hanging/loading state with no replay affordance (not yet implemented)",
  );

  test("a permanently-failing message surfaces an error state and a replay affordance", async ({
    page,
  }) => {
    // Send a payload crafted to trigger a permanent failure.
    // "__DLQ_TRIGGER__" is a sentinel the backend (once wired) can use to
    // force-fail immediately without retrying.  For now the spec documents the
    // intended injection point.
    const input = page.locator(CHAT_INPUT);
    await input.fill("__DLQ_TRIGGER__: force permanent failure for e2e test");

    await page.locator(SUBMIT_BUTTON).click();

    // Wait up to 30 s for ANY error/replay signal to appear
    const errorLocators = page.locator(ERROR_STATE_SELECTORS.join(", "));
    await expect(errorLocators.first()).toBeVisible({ timeout: 30_000 });

    // Additional assertion: the loading spinner must NOT still be visible after
    // the error surface appears (i.e., the UI has settled, not hung).
    await expect(page.locator(".animate-spin")).toBeHidden({ timeout: 5_000 });

    // The replay affordance must be interactive
    const replayAffordance = page.locator(
      "button:has-text('Retry'), button:has-text('Replay'), [data-testid='replay-button']",
    );
    await expect(replayAffordance.first()).toBeEnabled();
  });
});
