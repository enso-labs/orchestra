/**
 * Resiliency spec: Correlation / request ID surfaced on error
 *
 * When the API returns an error, the UI must display a correlation or request
 * reference identifier on the error surface so users can include it in bug
 * reports and operators can trace the request in logs.
 *
 * Expected format: any alphanumeric/UUID string accompanying an error message,
 * e.g. "Request ID: abc123-…" or a `data-correlation-id` attribute.
 *
 * Today, error messages are surfaced without a reference ID, so this test is
 * annotated test.fail().
 *
 * FLIP: remove test.fail() once correlation-ID surfacing lands.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

const CHAT_INPUT = 'textarea[placeholder="How can I help you be more productive?"]';
const SUBMIT_BUTTON = '[data-tour="chat-submit-button"]';

// UUID / correlation-ID pattern: any run of hex + hyphens of reasonable length
const CORRELATION_ID_PATTERN = /[0-9a-f-]{8,}/i;

test.describe("Correlation ID on error surface", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/", { waitUntil: "networkidle" });
  });

  // FLIP: remove test.fail() once correlation-ID surfacing lands.
  test.fail(
    true,
    "Error surfaces today do not display a correlation/request ID (feature not yet implemented)",
  );

  test("an API error response surfaces a correlation ID visible to the user", async ({
    page,
  }) => {
    // Intercept and force an error response from the API so we get a
    // deterministic failure without relying on an unstable backend path.
    await page.route("**/api/runs**", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "Internal Server Error",
          // The backend is expected to include a request/correlation ID.
          // This mock documents the intended shape; replace once the backend
          // ships the field.
          request_id: "e2e-mock-correlation-00000000-0000-0000-0000-000000000000",
        }),
      });
    });

    const input = page.locator(CHAT_INPUT);
    await input.fill("trigger correlation id test");
    await page.locator(SUBMIT_BUTTON).click();

    // Wait for any error surface
    const errorRegion = page.locator(
      "[role='alert'], [data-testid='error-message'], text=error, text=Error",
    );
    await expect(errorRegion.first()).toBeVisible({ timeout: 15_000 });

    // The error surface must contain a string matching a correlation/request ID
    const errorText = await page.locator("body").textContent();
    expect(errorText).toMatch(CORRELATION_ID_PATTERN);

    // Preferred: a labelled reference ID element
    const labelledId = page.locator(
      "[data-testid='correlation-id'], [data-correlation-id], :text-matches('(Request|Correlation|Trace|Request ID)[:\\s]+[0-9a-f-]{8,}', 'i')",
    );
    await expect(labelledId.first()).toBeVisible({ timeout: 5_000 });
  });
});
