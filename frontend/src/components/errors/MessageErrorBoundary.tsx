/**
 * MessageErrorBoundary Component
 *
 * Error boundary to catch rendering errors in message components.
 * Provides graceful fallback UI and optional debug information.
 */

import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertCircle } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
	errorInfo: ErrorInfo | null;
}

// ============================================================================
// Component
// ============================================================================

export default class MessageErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		};
	}

	static getDerivedStateFromError(_error: Error): Partial<State> {
		// Update state so the next render will show the fallback UI
		return { hasError: true };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		// Log the error to console with context
		console.error('[MessageErrorBoundary] Caught error:', {
			message: error.message,
			stack: error.stack,
			componentStack: errorInfo.componentStack,
			timestamp: new Date().toISOString(),
		});

		// Update state with error details
		this.setState({
			error,
			errorInfo,
		});
	}

	handleReset = () => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
		});
	};

	render() {
		if (this.state.hasError) {
			// Custom fallback UI if provided
			if (this.props.fallback) {
				return this.props.fallback;
			}

			// Default fallback UI
			const isDev = process.env.NODE_ENV === 'development';

			return (
				<div className="border border-red-500/50 bg-red-500/10 rounded-lg p-3 my-2">
					<div className="flex items-start gap-2">
						<AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
						<div className="flex-1 min-w-0">
							<p className="text-sm text-red-500 font-medium">
								Failed to render message
							</p>
							<p className="text-xs text-red-500/80 mt-1">
								This message encountered an error and cannot be displayed.
							</p>

							{/* Debug details (dev mode only) */}
							{isDev && this.state.error && (
								<details className="mt-2">
									<summary className="cursor-pointer text-xs text-red-500/90 hover:text-red-500">
										Error details
									</summary>
									<pre className="text-xs mt-1 overflow-auto max-h-40 bg-red-500/5 p-2 rounded border border-red-500/20">
										{this.state.error.message}
										{'\n\n'}
										{this.state.error.stack}
									</pre>
								</details>
							)}

							{/* Retry button */}
							<button
								onClick={this.handleReset}
								className="mt-2 text-xs px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-500 transition-colors"
							>
								Retry
							</button>
						</div>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
