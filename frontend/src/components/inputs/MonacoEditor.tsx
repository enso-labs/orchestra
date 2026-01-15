import Editor from "@monaco-editor/react";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/hooks/useTheme";

interface Props {
	value: string;
	handleChange?: (val: string) => void;
	language?: string;
	readOnly?: boolean;
	height?: string;
	options?: {
		minimap?: boolean;
		lineNumbers?: boolean | "on" | "off";
		wordWrap?: "on" | "off" | "wordWrapColumn" | "bounded";
		fontSize?: number;
		tabSize?: number;
		scrollBeyondLastLine?: boolean;
		folding?: boolean;
		renderLineHighlight?: "none" | "gutter" | "line" | "all";
		scrollbar?: {
			vertical?: "auto" | "visible" | "hidden";
			horizontal?: "auto" | "visible" | "hidden";
		};
	};
}

function MonacoEditor({
	value,
	handleChange,
	language,
	readOnly,
	height,
	options,
}: Props) {
	const [error, setError] = useState("");
	const [editorValue, setEditorValue] = useState(value);
	const prevValueRef = useRef(value);
	const { theme } = useTheme();

	// Select Monaco theme based on current app theme
	const getEditorTheme = () => {
		if (theme === "light") {
			return "light";
		}
		// Use dark theme for both "dark" and "gray" themes, and system default
		return "vs-dark";
	};

	// Only update editor value when the external value prop changes (not when editorValue changes)
	useEffect(() => {
		// Skip if the prop value hasn't actually changed
		if (prevValueRef.current === value) {
			return;
		}
		prevValueRef.current = value;

		// Only do JSON comparison for JSON language
		if (language === "json" || !language) {
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
		} else {
			// For non-JSON, simple string comparison
			if (value !== editorValue) {
				setEditorValue(value);
			}
		}
	}, [value, language, editorValue]);

	const onChange = (val: any) => {
		setEditorValue(val);

		// Only validate for JSON language
		if (language === "json" || !language) {
			try {
				JSON.parse(val); // This will throw if invalid JSON
				setError("");
			} catch (e: any) {
				setError(`${e.name}: ${e.message}`);
			}
		} else {
			// No validation for other languages
			setError("");
		}

		// Call handleChange if provided
		handleChange?.(val);
	};

	return (
		<div className="flex flex-col h-full w-full">
			{error && (language === "json" || !language) && (
				<pre className="text-red-500 text-sm whitespace-pre-wrap">{error}</pre>
			)}
			<div className="flex-1 min-h-0">
				<Editor
					value={editorValue}
					onChange={onChange}
					defaultLanguage={language || "json"}
					height={height || "80vh"}
					theme={getEditorTheme()}
					options={{
						fontSize: options?.fontSize || 12,
						tabSize: options?.tabSize || 2,
						insertSpaces: true,
						minimap: {
							enabled:
								options?.minimap === true || options?.minimap === false
									? options.minimap
									: false,
						},
						lineNumbers:
							options?.lineNumbers === true
								? "on"
								: options?.lineNumbers === false
									? "off"
									: options?.lineNumbers || "on",
						wordWrap: options?.wordWrap || "off",
						readOnly: readOnly || false,
						scrollBeyondLastLine: options?.scrollBeyondLastLine ?? true,
						folding: options?.folding ?? true,
						renderLineHighlight: options?.renderLineHighlight || "line",
						scrollbar: options?.scrollbar,
					}}
				/>
			</div>
		</div>
	);
}

export default MonacoEditor;
