/**
 * Resiliency spec: Heartbeat / stream drain on worker loss
 *
 * Scenario:
 *   1. Start a streaming run (send a message that will trigger a long response).
 *   2. Simulate worker loss mid-stream by intercepting SSE and closing the
 *      connection prematurely.
 *   3. Reload the page.
 *   4. The active-stream recovery hook (useActiveStreamRecovery.ts) should
 *      detect the in-progress run via `ruska.active_streams.v1` in localStorage
 *      and re-attach, surfacing the "Lost connection… refresh to retry" message
 *      or automatically resuming.
 *
 * Today, worker loss leaves the stream silently broken with no recovery on
 * reload, so this test is annotated test.fail().
 *
 * FLIP: remove test.fail() once heartbeat-drain + stream recovery lands.
 *
 * Injection hook notes:
 *   - localStorage key: "ruska.active_streams.v1"
 *     Shape: { [threadId]: { runId: string; lastEventId: string | null } }
 *   - The recovery hook reads this key in useActiveStreamRecovery.ts and calls
 *     attachToDistributedStream() if thread.metadata.stream_status === "running".
 *   - "Lost connection… refresh to retry" text lives in streamClient.ts /
 *     the component that surfaces reconnect events.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

const CHAT_INPUT = 'textarea[placeholder="How can I help you be more productive?"]';
const SUBMIT_BUTTON = '[data-tour="chat-submit-button"]';
const ASSISTANT_BUBBLE = "div.rounded-bl-sm";

// localStorage key used by the active-stream recovery subsystem
const ACTIVE_STREAMS_KEY = "ruska.active_streams.v1";

// Text that the recovery subsystem surfaces when reconnection is needed
const LOST_CONNECTION_TEXT = "Lost connection";

test.describe("Heartbeat / stream drain recovery", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/", { waitUntil: "networkidle" });
  });

  // FLIP: remove test.fail() once heartbeat-drain + stream recovery lands.
  test.fail(
    true,
    "Worker-loss recovery is not yet implemented; reload after mid-stream disconnect does not resume or surface the reconnect message",
  );

  test("after simulated worker loss, reload surfaces recovery message or resumes the stream", async ({
    page,
  }) => {
    // Step 1: Start a streaming run
    const input = page.locator(CHAT_INPUT);
    await input.fill(
      "Write a very long essay about distributed systems resilience, at least 500 words.",
    );
    await page.locator(SUBMIT_BUTTON).click();

    // Wait for at least one token to arrive (loading spinner appears first)
    await expect(page.locator(".animate-spin").first()).toBeVisible({
      timeout: 15_000,
    });

    // Step 2: Capture the current thread URL so we can re-navigate after reload
    const threadUrl = page.url();

    // Step 3: Simulate worker loss by aborting all SSE connections mid-stream
    // and injecting a recovery record into localStorage.
    // The injection mirrors what the app would have written if the connection
    // dropped naturally — the spec documents the hook, not a live connection.
    await page.evaluate((key) => {
      // Inject a synthetic "in-progress" recovery record.
      // In production this would be written by the app before the disconnect.
      const syntheticRecord: Record<string, { runId: string; lastEventId: string | null }> = {};
      // Use a placeholder run ID; the backend mock (not running here) would
      // use a real UUID.  The recovery hook will attempt to reattach and fail
      // gracefully, surfacing the lost-connection message.
      const threadIdMatch = window.location.pathname.match(/thread\/([^/]+)/);
      const threadId = threadIdMatch ? threadIdMatch[1] : "synthetic-thread-id";
      syntheticRecord[threadId] = {
        runId: "synthetic-run-id-00000000-0000-0000-0000-000000000000",
        lastEventId: null,
      };
      localStorage.setItem(key, JSON.stringify(syntheticRecord));
    }, ACTIVE_STREAMS_KEY);

    // Abort all in-flight requests to simulate the worker going away
    await page.route("**/api/runs/**", (route) => route.abort("connectionreset"));

    // Step 4: Reload the page
    await page.goto(threadUrl, { waitUntil: "networkidle" });

    // Step 5: Assert recovery — either the reconnect message is shown OR the
    // stream resumes (an assistant bubble appears within a reasonable window).
    const lostConnectionLocator = page.locator(`text=${LOST_CONNECTION_TEXT}`);
    const assistantBubble = page.locator(ASSISTANT_BUBBLE).first();

    // At least one of these must materialise within 20 s
    await expect(
      lostConnectionLocator.or(assistantBubble),
    ).toBeVisible({ timeout: 20_000 });

    // Additionally verify that the recovery key was consumed (cleared) after
    // a successful reattachment, OR still present while reconnecting
    const storageValue = await page.evaluate(
      (key) => localStorage.getItem(key),
      ACTIVE_STREAMS_KEY,
    );
    // Either cleared (recovered) or still set (in-progress reconnect) is acceptable;
    // what is NOT acceptable is a completely silent UI with no recovery signal.
    // This assertion documents the expected state rather than gating on it.
    console.log(`[heartbeat-drain] ${ACTIVE_STREAMS_KEY} after reload:`, storageValue);
  });
});
