import type React from "react";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionProps {
	items: {
		title: string;
		content: React.ReactNode;
	}[];
	defaultExpanded?: number;
	className?: string;
}

function AccordionZero({
	items,
	defaultExpanded = -1,
	className,
}: AccordionProps) {
	const [expandedIndex, setExpandedIndex] = useState<number>(defaultExpanded);

	const toggleItem = (index: number) => {
		setExpandedIndex((prevIndex) => (prevIndex === index ? -1 : index));
	};

	return (
		<div className={cn("w-full mx-auto space-y-2", className)}>
			{items.map((item, index) => (
				<div key={index} className="border rounded-md overflow-hidden">
					<button
						onClick={() => toggleItem(index)}
						className="flex justify-between items-center w-full p-4 text-left bg-secondary hover:bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200"
						aria-expanded={expandedIndex === index}
						aria-controls={`accordion-content-${index}`}
					>
						<span className="font-medium">{item.title}</span>
						<ChevronDown
							className={cn(
								"h-5 w-5 text-gray-500 transition-transform duration-200",
								expandedIndex === index ? "rotate-180" : "",
							)}
						/>
					</button>
					<div
						id={`accordion-content-${index}`}
						role="region"
						aria-labelledby={`accordion-header-${index}`}
						className={cn(
							"overflow-hidden transition-all duration-200",
							expandedIndex === index ? "max-h-96 p-4" : "max-h-0 p-0",
						)}
					>
						{item.content}
					</div>
				</div>
			))}
		</div>
	);
}

export default AccordionZero;
