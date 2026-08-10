import { expect, type Locator, type Page } from "@playwright/test";

const CHAT_INPUT_SELECTOR =
	'textarea[placeholder="How can I help you be more productive?"]:visible';
const CHAT_SUBMIT_BUTTON_SELECTOR =
	'[data-tour="chat-submit-button"] button:visible';
const CHAT_READY_TIMEOUT = 30_000;

/**
 * Resolve the currently rendered chat input, ignoring stale hidden composers
 * while the empty-state and full chat layouts transition.
 */
export function chatInput(page: Page): Locator {
	return page.locator(CHAT_INPUT_SELECTOR).first();
}

/**
 * Wait until the visible composer is mounted and accepts input. The visible
 * selector is important on mobile, where a hidden layout can coexist briefly
 * with the active composer during route/layout transitions.
 */
export async function waitForChatInput(page: Page): Promise<Locator> {
	const input = chatInput(page);
	await expect(input).toBeVisible({ timeout: CHAT_READY_TIMEOUT });
	await expect(input).toBeEditable({ timeout: CHAT_READY_TIMEOUT });
	return input;
}

/** Resolve the actual button rather than its onboarding wrapper container. */
export function chatSubmitButton(page: Page): Locator {
	return page.locator(CHAT_SUBMIT_BUTTON_SELECTOR).first();
}
