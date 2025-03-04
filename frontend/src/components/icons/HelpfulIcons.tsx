
export default function HelpfulIcons() {
	return (
		<div className="text-center flex justify-center gap-2 my-3">
			<a href="/docs/" target="_blank" className="hover:opacity-80 transition-opacity" rel="noreferrer">
				<img src="https://img.shields.io/badge/View%20Documentation-Docs-blue" alt="Documentation" />
			</a>
			<a
				href="https://github.com/ryaneggz/langgraph-template"
				target="_blank"
				className="hover:opacity-80 transition-opacity"
				rel="noreferrer"
			>
				<img src="https://img.shields.io/badge/Join%20our%20community-Github-black" alt="Github" />
			</a>
		</div>
	)
}
