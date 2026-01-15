/**
 * Service for thread sharing operations.
 *
 * Provides methods to create, retrieve, and manage share links for threads.
 */

import apiClient from "@/lib/utils/apiClient";
import { getAuthToken } from "@/lib/utils/auth";

export interface ShareOptions {
	expires_in_hours?: number;
	allow_follow_up?: boolean;
	follow_up_model?: string;
}

export interface ShareResponse {
	token: string;
	prefix: string;
	thread_id: string;
	share_url: string;
	expires_at: string | null;
	allow_follow_up: boolean;
}

export interface SharedThread {
	thread_id: string;
	title: string | null;
	messages: any[];
	files: Record<string, any> | null;
	todos: any[] | null;
	shared_at: string | null;
	allow_follow_up: boolean;
	follow_up_model: string | null;
}

export interface SharedThreadResponse {
	thread: SharedThread;
	config: {
		allow_follow_up: boolean;
		follow_up_model: string | null;
	};
}

export interface ShareListItem {
	prefix: string;
	thread_id: string;
	share_url: string;
	allow_follow_up: boolean;
	expires_at: string | null;
	view_count: number;
	created_at: string | null;
	is_valid: boolean;
}

/**
 * Create a share link for a thread.
 *
 * @param threadId - ID of the thread to share
 * @param options - Share configuration options
 * @returns ShareResponse with the full token (returned only once)
 */
export async function createShare(
	threadId: string,
	options: ShareOptions = {}
): Promise<ShareResponse> {
	const response = await apiClient.post(
		`/threads/${threadId}/share`,
		options,
		{
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${getAuthToken()}`,
			},
		}
	);
	return response.data;
}

/**
 * Get a shared thread by token (no authentication required).
 *
 * @param token - Full share token (shr_xxx...)
 * @returns Shared thread data including messages and files
 */
export async function getSharedThread(
	token: string
): Promise<SharedThreadResponse> {
	const response = await apiClient.get(`/shares/${token}`);
	return response.data;
}

/**
 * Revoke the share link for a thread.
 *
 * @param threadId - ID of the thread to revoke share for
 */
export async function revokeShare(threadId: string): Promise<void> {
	await apiClient.delete(`/threads/${threadId}/share`, {
		headers: {
			Authorization: `Bearer ${getAuthToken()}`,
		},
	});
}

/**
 * List all share links created by the current user.
 *
 * @returns List of share links with metadata
 */
export async function listShares(): Promise<{ shares: ShareListItem[] }> {
	const response = await apiClient.get("/shares", {
		headers: {
			Authorization: `Bearer ${getAuthToken()}`,
		},
	});
	return response.data;
}

export const shareService = {
	createShare,
	getSharedThread,
	revokeShare,
	listShares,
};

export default shareService;
