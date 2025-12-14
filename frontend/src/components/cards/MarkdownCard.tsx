import { useState, useRef, useEffect } from "react";
import { Button } from "../ui/button";
import { Check, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
	oneDark,
	oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";

// Use to create links in markdown
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { ImagePreviewModal } from "../inputs/ImagePreviewModal";
import useImageHook from "@/hooks/useImageHook";
import { useTheme } from "@/hooks/useTheme";
import mermaid from "mermaid";

interface CodeBlockProps {
	inline?: boolean;
	className?: string;
	children: React.ReactNode;
}

const CodeBlock: React.FC<CodeBlockProps> = ({
	inline,
	className,
	children,
	...props
}) => {
	const [copied, setCopied] = useState(false);
	const [mermaidSvg, setMermaidSvg] = useState<string>("");
	const [mermaidError, setMermaidError] = useState<string>("");
	const mermaidRef = useRef<HTMLDivElement>(null);
	const { theme } = useTheme();
	const match = /language-(\w+)/.exec(className || "");
	const language = match ? match[1] : "";
	const code = String(children).replace(/\n$/, "");

	// Select syntax highlighting theme based on current theme
	const getSyntaxTheme = () => {
		if (theme === "light") {
			return oneLight;
		}
		// Use dark theme for both "dark" and "gray" themes, and system default
		return oneDark;
	};

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy code:", err);
		}
	};

	// Initialize mermaid with theme
	useEffect(() => {
		const mermaidTheme = theme === "light" ? "default" : "dark";
		mermaid.initialize({
			startOnLoad: false,
			theme: mermaidTheme,
			securityLevel: "loose",
		});
	}, [theme]);

	// Render mermaid diagrams
	useEffect(() => {
		if (language === "mermaid" && code) {
			const renderDiagram = async () => {
				try {
					setMermaidError("");
					const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
					const { svg } = await mermaid.render(id, code);
					setMermaidSvg(svg);
				} catch (error) {
					console.error("Mermaid rendering error:", error);
					setMermaidError(
						error instanceof Error ? error.message : "Failed to render diagram",
					);
				}
			};
			renderDiagram();
		}
	}, [language, code, theme]);

	// Check if this is inline code (no newlines) or a code block (has newlines)
	const isInlineCode = inline || !code.includes("\n");

	if (!language && isInlineCode) {
		return (
			<code
				className="rounded text-green-400 bg-green-400/10 px-1 py-0.5 text-sm font-mono whitespace-pre-wrap break-words"
				{...props}
			>
				{children}
			</code>
		);
	}

	// For code blocks without a language, render with wrapping
	if (!language) {
		return (
			<div className="relative group my-2">
				<pre className="bg-muted/50 rounded-lg p-3 overflow-x-auto">
					<code
						className="text-sm font-mono whitespace-pre-wrap break-words"
						{...props}
					>
						{children}
					</code>
				</pre>
			</div>
		);
	}

	// Handle Mermaid diagrams
	if (language === "mermaid") {
		return (
			<div className="relative group my-2">
				<div className="flex items-center justify-between bg-muted/50 px-3 py-1.5 rounded-t-lg border-b border-border">
					<span className="text-xs text-muted-foreground font-medium">
						mermaid diagram
					</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={handleCopy}
						className="h-6 w-6 p-0 hover:bg-muted"
					>
						{copied ? (
							<Check className="h-3 w-3 text-green-500" />
						) : (
							<Copy className="h-3 w-3" />
						)}
					</Button>
				</div>
				{mermaidError ? (
					<div className="bg-red-500/10 border border-red-500/20 rounded-b-lg p-4">
						<p className="text-xs text-red-400 mb-2">
							Failed to render diagram:
						</p>
						<pre className="text-xs text-red-300 whitespace-pre-wrap">
							{mermaidError}
						</pre>
					</div>
				) : mermaidSvg ? (
					<div
						ref={mermaidRef}
						className="bg-muted/50 rounded-b-lg p-4 flex justify-center items-center overflow-x-auto"
						dangerouslySetInnerHTML={{ __html: mermaidSvg }}
					/>
				) : (
					<div className="bg-muted/50 rounded-b-lg p-4 flex justify-center items-center">
						<span className="text-xs text-muted-foreground">
							Rendering diagram...
						</span>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="relative group my-2">
			<div className="flex items-center justify-between bg-muted/50 px-3 py-1.5 rounded-t-lg border-b border-border">
				<span className="text-xs text-muted-foreground font-medium">
					{language || "code"}
				</span>
				<Button
					variant="ghost"
					size="sm"
					onClick={handleCopy}
					className="h-6 w-6 p-0 hover:bg-muted"
				>
					{copied ? (
						<Check className="h-3 w-3 text-green-500" />
					) : (
						<Copy className="h-3 w-3" />
					)}
				</Button>
			</div>
			<SyntaxHighlighter
				style={getSyntaxTheme()}
				language={language}
				PreTag="div"
				className="!mt-0 !rounded-t-none"
				wrapLongLines={true}
				customStyle={{
					margin: 0,
					borderTopLeftRadius: 0,
					borderTopRightRadius: 0,
					fontSize: "10px",
				}}
			>
				{code}
			</SyntaxHighlighter>
		</div>
	);
};

const ExpandableCell: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [isExpanded, setIsExpanded] = useState(false);
	const [isOverflow, setIsOverflow] = useState(false);
	const cellRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const checkOverflow = () => {
			if (cellRef.current) {
				const element = cellRef.current;
				const hasOverflow = element.scrollHeight > 200;
				setIsOverflow(hasOverflow);
			}
		};

		// Check overflow after component mounts and when content changes
		checkOverflow();

		// Use ResizeObserver to detect content changes
		const observer = new ResizeObserver(checkOverflow);
		if (cellRef.current) {
			observer.observe(cellRef.current);
		}

		return () => observer.disconnect();
	}, [children]);

	return (
		<div className="relative">
			<div
				ref={cellRef}
				className={`transition-all duration-300 overflow-hidden ${
					isExpanded ? "max-h-none" : "max-h-[150px]"
				}`}
			>
				{children}
			</div>
			{isOverflow && (
				<div className="flex justify-center pt-2 border-t border-border/30 mt-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setIsExpanded(!isExpanded)}
						className="h-6 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
					>
						{isExpanded ? (
							<>
								Show Less <ChevronUp className="h-3 w-3" />
							</>
						) : (
							<>
								Show More <ChevronDown className="h-3 w-3" />
							</>
						)}
					</Button>
				</div>
			)}
		</div>
	);
};

const footnoteSchema = {
	...defaultSchema,
	tagNames: [...(defaultSchema.tagNames || []), "section", "sup"],
	attributes: {
		...defaultSchema.attributes,
		section: [
			...(defaultSchema.attributes?.section || []),
			["data-footnotes", true],
		],
		sup: [
			...(defaultSchema.attributes?.sup || []),
			["data-footnote-ref", true],
			"id",
		],
		a: [
			...(defaultSchema.attributes?.a || []),
			["data-footnote-backref", true],
			"href",
			"id",
			"aria-describedby",
		],
	},
};

const BaseCard = ({ content }: { content: string }) => {
	return (
		<ReactMarkdown
			components={{
				h1: ({ node: _node, ...props }) => (
					<h1 className="text-2xl font-bold my-4" {...props} />
				),
				h2: ({ node: _node, ...props }) => (
					<h2 className="text-xl font-bold my-4" {...props} />
				),
				h3: ({ node: _node, ...props }) => (
					<h3 className="text-base font-bold mt-3 mb-2" {...props} />
				),
				p: ({ node: _node, ...props }) => <p className={`py-2`} {...props} />,
				code: CodeBlock as React.ComponentType<any>,
				ul: ({ node: _node, ...props }) => (
					<ul className="list-disc pl-5 my-2" {...props} />
				),
				ol: ({ ...props }) => (
					<ol className="list-decimal mb-2 space-y-1" {...props} />
				),
				li: ({ node: _node, ...props }) => <li className="ml-2" {...props} />,
				a: ({ node, ...props }) => (
					<a
						target="_blank"
						className="text-blue-300 underline hover:text-blue-300/80"
						{...props}
					/>
				),
				table: ({ node, ...props }) => (
					<div className="overflow-x-auto my-6 rounded-lg border-2 border-border shadow-md bg-background">
						<table
							className="min-w-full divide-y-2 divide-border bg-background border-collapse"
							{...props}
						/>
					</div>
				),
				thead: ({ node, ...props }) => (
					<thead className="bg-muted/60 border-b-2 border-border" {...props} />
				),
				tbody: ({ node, ...props }) => (
					<tbody
						className="divide-y-2 divide-border bg-background"
						{...props}
					/>
				),
				tr: ({ node, ...props }) => (
					<tr
						className="transition-colors hover:bg-muted/30 group even:bg-muted/10 border-b border-border"
						{...props}
					/>
				),
				th: ({ node, ...props }) => (
					<th
						className="px-3 py-1 text-left text-sm font-bold text-foreground tracking-wider uppercase bg-gradient-to-b from-muted/40 to-muted/70 first:rounded-tl-lg last:rounded-tr-lg border-r-2 border-border last:border-r-0"
						{...props}
					/>
				),
				td: ({ node, ...props }) => (
					<td
						className="px-3 py-1 text-sm text-foreground border-r-2 border-border last:border-r-0 group-hover:text-foreground/90 transition-colors align-top"
						{...props}
					>
						<ExpandableCell>{props.children}</ExpandableCell>
					</td>
				),
				hr: () => <hr className="my-5" />,
			}}
			remarkPlugins={[
				remarkGfm,
				// remarkMath,
			]}
			rehypePlugins={[[rehypeSanitize, footnoteSchema]]}
			remarkRehypeOptions={{ passThrough: ["link"] }}
		>
			{content}
		</ReactMarkdown>
	);
};

const MarkdownCard = ({ content }: { content: string | any[] }) => {
	const {
		handleImageClick,
		handleImageClear,
		previewImage,
		previewImageIndex,
	} = useImageHook();

	// If string, return a single card
	if (typeof content === "string") {
		return <BaseCard content={content} />;
	}
	// If array, return a list of cards
	if (Array.isArray(content)) {
		return content.map((item, index) => {
			if (item.type === "text") {
				return <BaseCard content={item.text} key={index} />;
			}
			if (item.type === "image_url") {
				return (
					<div className="flex justify-center items-center py-1" key={index}>
						<img
							src={item.image_url.url}
							alt="image"
							className="cursor-pointer"
							onClick={() => handleImageClick(item.image_url.url, index)}
						/>
						{previewImage && (
							<ImagePreviewModal
								image={previewImage}
								index={previewImageIndex}
								onClose={() => handleImageClear()}
							/>
						)}
					</div>
				);
			}
		});
	}
	console.error("Invalid content");
	throw new Error("Invalid content");
};

export default MarkdownCard;
