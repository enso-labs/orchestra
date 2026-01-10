/**
 * Path sanitization utilities for file tree operations
 * Provides security against XSS and path traversal attacks
 */

/**
 * Sanitizes file paths to prevent path traversal and normalize format
 * @param path - Raw file path from user input
 * @returns Sanitized, normalized path
 */
export function sanitizePath(path: string): string {
	if (!path) return "/";

	// Remove null bytes
	let sanitized = path.replace(/\0/g, "");

	// Normalize path separators (Windows → Unix)
	sanitized = sanitized.replace(/\\/g, "/");

	// Remove path traversal attempts
	sanitized = sanitized.replace(/\.\./g, "");

	// Remove leading/trailing whitespace
	sanitized = sanitized.trim();

	// Ensure path starts with /
	if (!sanitized.startsWith("/")) {
		sanitized = "/" + sanitized;
	}

	// Remove consecutive slashes
	sanitized = sanitized.replace(/\/+/g, "/");

	// Remove trailing slash (except for root)
	if (sanitized.length > 1 && sanitized.endsWith("/")) {
		sanitized = sanitized.slice(0, -1);
	}

	return sanitized;
}

/**
 * HTML entity map for escaping
 */
const HTML_ENTITIES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#039;",
};

/**
 * Escapes HTML entities to prevent XSS attacks
 * @param text - Raw text that may contain HTML
 * @returns Text with HTML entities escaped
 */
export function escapeHtml(text: string): string {
	if (!text) return "";
	return text.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Extracts and sanitizes the display name from a file path
 * @param path - Full file path
 * @returns Safe display name (filename without path)
 */
export function getDisplayName(path: string): string {
	const sanitized = sanitizePath(path);
	const segments = sanitized.split("/").filter(Boolean);
	const name = segments[segments.length - 1] || "Untitled";
	return escapeHtml(name);
}

/**
 * Extracts the parent directory path from a file path
 * @param path - Full file path
 * @returns Parent directory path
 */
export function getParentPath(path: string): string {
	const sanitized = sanitizePath(path);
	const segments = sanitized.split("/").filter(Boolean);
	if (segments.length <= 1) return "/";
	return "/" + segments.slice(0, -1).join("/");
}

/**
 * Joins path segments safely
 * @param base - Base path
 * @param segment - Segment to append
 * @returns Combined sanitized path
 */
export function joinPath(base: string, segment: string): string {
	const sanitizedBase = sanitizePath(base);
	const sanitizedSegment = segment.replace(/^\/+|\/+$/g, "").replace(/\//g, "");

	if (!sanitizedSegment) return sanitizedBase;

	if (sanitizedBase === "/") {
		return "/" + sanitizedSegment;
	}

	return sanitizedBase + "/" + sanitizedSegment;
}

/**
 * Gets the file extension from a path
 * @param path - File path
 * @returns Extension without dot, or empty string
 */
export function getExtension(path: string): string {
	const name = getDisplayName(path);
	const lastDot = name.lastIndexOf(".");
	if (lastDot === -1 || lastDot === 0) return "";
	return name.slice(lastDot + 1).toLowerCase();
}
