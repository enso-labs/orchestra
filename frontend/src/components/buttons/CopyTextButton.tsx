import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

function CopyTextButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.stopPropagation();
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy code:", err);
		}
	};

	return (
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
	);
}

export default CopyTextButton;
