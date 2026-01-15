import MonacoEditor from "@/components/inputs/MonacoEditor";

interface Props {
	selectedToolMessage: any;
	/**
	 * @deprecated This prop is retained for API compatibility but has no effect.
	 * Monaco Editor does not support collapsible JSON nodes.
	 */
	collapsed?: boolean;
}

export default function DefaultTool({
	selectedToolMessage,
	collapsed: _collapsed = true,
}: Props) {
	if (!selectedToolMessage) return null;

	// Check for field existence to properly handle explicit null values
	const input =
		"args" in selectedToolMessage
			? selectedToolMessage.args
			: "input" in selectedToolMessage
				? selectedToolMessage.input
				: selectedToolMessage.content;

	// Format and validate JSON for Monaco display
	const formatInput = (): { value: string; isValid: boolean } => {
		try {
			const parsed = typeof input === "object" ? input : JSON.parse(input);

			if (parsed === null || parsed === undefined) {
				return { value: "null", isValid: true };
			}

			if (typeof parsed !== "object") {
				return { value: String(parsed), isValid: true };
			}

			return { value: JSON.stringify(parsed, null, 2), isValid: true };
		} catch {
			return { value: "", isValid: false };
		}
	};

	const { value, isValid } = formatInput();

	if (!isValid) {
		return (
			<div className="text-red-500 max-h-[100px] overflow-auto">
				<p className="font-bold text-xs">Error parsing JSON</p>
				<pre className="whitespace-pre-wrap text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">
					{typeof input === "string" ? input : JSON.stringify(input)}
				</pre>
			</div>
		);
	}

	return (
		<div className="rounded overflow-hidden border border-border/50">
			<MonacoEditor
				value={value}
				language="json"
				readOnly={true}
				height="100px"
				options={{
					minimap: false,
					lineNumbers: "off",
					wordWrap: "on",
					fontSize: 10,
					tabSize: 2,
					scrollBeyondLastLine: false,
					folding: false,
					renderLineHighlight: "none",
					scrollbar: {
						vertical: "auto",
						horizontal: "hidden",
					},
				}}
			/>
		</div>
	);
}
