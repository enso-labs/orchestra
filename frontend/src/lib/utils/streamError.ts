/**
 * Error classification for stream errors.
 * Helps determine which errors are retryable and provides user-friendly messages.
 */

export type StreamErrorCode =
	| "NETWORK"
	| "AUTH"
	| "RATE_LIMIT"
	| "TIMEOUT"
	| "SERVER"
	| "PARSE";

export interface StreamError {
	code: StreamErrorCode;
	message: string;
	retryable: boolean;
	httpStatus?: number;
}

/**
 * Classifies an error and determines if it's retryable.
 *
 * @param error - The error to classify
 * @param httpStatus - Optional HTTP status code
 * @returns Classified StreamError
 */
export function classifyError(error: Error, httpStatus?: number): StreamError {
	// Check for specific HTTP status codes
	if (httpStatus) {
		if (httpStatus === 401) {
			return {
				code: "AUTH",
				message: "Please log in again",
				retryable: false,
				httpStatus,
			};
		}

		if (httpStatus === 429) {
			return {
				code: "RATE_LIMIT",
				message: "Too many requests, please wait",
				retryable: true,
				httpStatus,
			};
		}

		if (httpStatus >= 500 && httpStatus <= 503) {
			return {
				code: "SERVER",
				message: "Server error, retrying...",
				retryable: true,
				httpStatus,
			};
		}
	}

	// Network errors (fetch failed, connection refused, etc.)
	if (
		error.name === "TypeError" ||
		error.message.includes("Failed to fetch") ||
		error.message.includes("Network")
	) {
		return {
			code: "NETWORK",
			message: "Network error, retrying...",
			retryable: true,
		};
	}

	// Timeout errors
	if (
		error.name === "AbortError" ||
		error.message.includes("timeout") ||
		error.message.includes("Timeout")
	) {
		return {
			code: "TIMEOUT",
			message: "Response delayed, retrying...",
			retryable: true,
		};
	}

	// JSON parse errors
	if (error instanceof SyntaxError || error.message.includes("JSON")) {
		return {
			code: "PARSE",
			message: "Unexpected response format",
			retryable: false,
		};
	}

	// Check error message for common patterns
	if (error.message.includes("Authentication")) {
		return {
			code: "AUTH",
			message: "Please log in again",
			retryable: false,
		};
	}

	if (error.message.includes("Rate limit")) {
		return {
			code: "RATE_LIMIT",
			message: "Too many requests, please wait",
			retryable: true,
		};
	}

	// Default: non-retryable server error
	return {
		code: "SERVER",
		message: error.message || "An error occurred",
		retryable: false,
	};
}

/**
 * Checks if an error is retryable based on classification.
 */
export function isRetryableError(error: Error, httpStatus?: number): boolean {
	const classified = classifyError(error, httpStatus);
	return classified.retryable;
}

/**
 * Gets a user-friendly error message.
 */
export function getErrorMessage(error: Error, httpStatus?: number): string {
	const classified = classifyError(error, httpStatus);
	return classified.message;
}
