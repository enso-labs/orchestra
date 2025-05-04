import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

function AccordionBase({
	items
}: {
	items: {
		title: string;
		content: React.ReactNode;
	}[];
}) {
	return (
		<Accordion type="single" collapsible>
			{items.map((item) => (
				<AccordionItem key={item.title} value={item.title}>
					<AccordionTrigger>{item.title}</AccordionTrigger>
					<AccordionContent>{item.content}</AccordionContent>
				</AccordionItem>
			))}
		</Accordion>
	)
}

export default AccordionBase;