import Editor from "@monaco-editor/react";
import { useState, useEffect } from "react";

interface Props {
	value: string;
	handleChange: (val: string) => void;
	language?: string;
}

function MonacoEditor({ value, handleChange, language }: Props) {
	const [error, setError] = useState("");
	const [editorValue, setEditorValue] = useState(value);

	// Only update editor value when the external value changes significantly
	useEffect(() => {
		try {
			const externalParsed = JSON.parse(value);
			const editorParsed = JSON.parse(editorValue);

			// Only update if the parsed objects are actually different
			if (JSON.stringify(externalParsed) !== JSON.stringify(editorParsed)) {
				setEditorValue(value);
			}
		} catch (e) {
			// If either can't be parsed, just compare strings
			if (value !== editorValue) {
				setEditorValue(value);
			}
		}
	}, [value]);

	const onChange = (val: any) => {
		setEditorValue(val);

		try {
			// For JSON language, validate the JSON before passing it up
			if (language === "json" || !language) {
				JSON.parse(val); // This will throw if invalid JSON
			}
			handleChange(val);
			setError("");
		} catch (e: any) {
			setError(`${e.name}: ${e.message}`);
			// Still call handleChange to update the raw value, but parent should handle the error
			handleChange(val);
		}
	};

	return (
		<div>
			<pre className="text-red-500 text-sm whitespace-pre-wrap">{error}</pre>
			<Editor
				value={editorValue}
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
