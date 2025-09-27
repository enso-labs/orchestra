import Editor from "@monaco-editor/react";
import { useState } from "react";

interface Props {
	value: string;
	handleChange: (val: string) => void;
	language?: string;
}

function MonacoEditor({ value, handleChange, language }: Props) {
	const [error, setError] = useState("");

	const onChange = (val: any) => {
		try {
			handleChange(val);
			setError("");
		} catch (e: any) {
			setError(`${e.name}: ${e.message}`);
		}
	};

	return (
		<div>
			<pre className="text-red-500 text-sm whitespace-pre-wrap">{error}</pre>
			<Editor
				value={value}
				onChange={onChange}
				defaultLanguage={language || "json"}
				height="80vh"
				theme="vs-dark"
				options={{
					fontSize: 12,
					tabSize: 2,
					insertSpaces: true,
				}}
			/>
		</div>
	);
}

export default MonacoEditor;
