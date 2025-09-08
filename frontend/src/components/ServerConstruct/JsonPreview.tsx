interface JsonPreviewProps {
	data: unknown;
}

export const JsonPreview = ({ data }: JsonPreviewProps) => {
	const formatJson = (obj: unknown) => {
		try {
			return JSON.stringify(obj, null, 2);
		} catch {
			return "Invalid JSON";
		}
	};
	return (
		<pre className="bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-auto max-h-[600px] text-sm">
			<code className="text-gray-800">{formatJson(data)}</code>
		</pre>
	);
};
