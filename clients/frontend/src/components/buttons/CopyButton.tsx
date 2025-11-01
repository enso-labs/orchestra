import { useState } from "react";

const CopyCodeButton = () => {
	// State to manage copy status
	const [isCopied, setIsCopied] = useState(false);

	const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		const preElement = (e.target as HTMLElement).closest("pre");
		const codeContent = preElement?.querySelector("code")?.innerText || "";

		navigator.clipboard
			.writeText(codeContent)
			.then(() => {
				setIsCopied(true);
				setTimeout(() => {
					setIsCopied(false);
				}, 1000); // Reset after 3 seconds
			})
			.catch((err) => {
				console.error("Failed to copy: ", err);
			});
	};

	return (
		<button className="flex gap-1 items-center" onClick={handleClick}>
			{isCopied ? "Copied" : "Copy code"}
		</button>
	);
};

export default CopyCodeButton;
