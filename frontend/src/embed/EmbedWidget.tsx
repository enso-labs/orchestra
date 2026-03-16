import { useState } from "react";

interface EmbedWidgetProps {
	agentId: string;
	apiBase: string;
	token?: string;
}

export function EmbedWidget({ agentId, apiBase, token }: EmbedWidgetProps) {
	const [open, setOpen] = useState(false);

	return (
		<div
			style={{
				position: "fixed",
				bottom: "20px",
				right: "20px",
				zIndex: 2147483647,
				fontFamily: "system-ui, -apple-system, sans-serif",
			}}
		>
			{open && (
				<div
					style={{
						width: "380px",
						height: "520px",
						marginBottom: "12px",
						borderRadius: "12px",
						background: "#fff",
						boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
						display: "flex",
						flexDirection: "column",
						overflow: "hidden",
						border: "1px solid #e5e7eb",
					}}
				>
					<div
						style={{
							padding: "16px",
							background: "#111",
							color: "#fff",
							fontSize: "14px",
							fontWeight: 600,
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<span>Chat</span>
						<button
							onClick={() => setOpen(false)}
							style={{
								background: "none",
								border: "none",
								color: "#fff",
								cursor: "pointer",
								fontSize: "18px",
								padding: "0 4px",
							}}
						>
							&times;
						</button>
					</div>
					<div
						style={{
							flex: 1,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "#6b7280",
							fontSize: "13px",
						}}
					>
						Chat widget loading...
					</div>
					<div
						style={{
							padding: "8px",
							textAlign: "center",
							fontSize: "11px",
							color: "#9ca3af",
							borderTop: "1px solid #e5e7eb",
						}}
					>
						Powered by{" "}
						<a
							href={`${apiBase}/a/${agentId}`}
							target="_blank"
							rel="noopener noreferrer"
							style={{ color: "#6b7280", textDecoration: "underline" }}
						>
							Orchestra
						</a>
					</div>
				</div>
			)}
			<button
				onClick={() => setOpen(!open)}
				aria-label="Open chat"
				data-agent-id={agentId}
				data-api-base={apiBase}
				data-token={token}
				style={{
					width: "56px",
					height: "56px",
					borderRadius: "50%",
					background: "#111",
					color: "#fff",
					border: "none",
					cursor: "pointer",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
					fontSize: "24px",
					marginLeft: "auto",
				}}
			>
				{open ? "×" : "💬"}
			</button>
		</div>
	);
}
