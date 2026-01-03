import { Circle, Loader2, CheckCircle2, ListTodo } from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils/index";

export interface Todo {
	content: string;
	status: "pending" | "in_progress" | "completed";
	activeForm?: string;
}

interface TodoListProps {
	todos: Todo[];
	className?: string;
}

const statusConfig = {
	pending: {
		icon: Circle,
		iconClass: "text-muted-foreground",
		textClass: "",
	},
	in_progress: {
		icon: Loader2,
		iconClass: "text-blue-500 animate-spin",
		textClass: "text-blue-500",
	},
	completed: {
		icon: CheckCircle2,
		iconClass: "text-green-500",
		textClass: "text-muted-foreground line-through",
	},
};

function TodoItem({ todo }: { todo: Todo }) {
	const config = statusConfig[todo.status] || statusConfig.pending;
	const Icon = config.icon;

	return (
		<div className="flex items-start gap-2 py-1.5">
			<Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.iconClass)} />
			<span className={cn("text-sm", config.textClass)}>{todo.content}</span>
		</div>
	);
}

export default function TodoList({ todos, className }: TodoListProps) {
	if (!todos || todos.length === 0) {
		return null;
	}

	const completedCount = todos.filter((t) => t.status === "completed").length;
	const inProgressTodo = todos.find((t) => t.status === "in_progress");

	return (
		<Accordion type="single" collapsible className={cn("w-full", className)}>
			<AccordionItem value="todos" className="border-border">
				<AccordionTrigger className="hover:no-underline py-2">
					<div className="flex items-center gap-2">
						<ListTodo className="h-4 w-4 text-primary" />
						<span className="text-sm font-medium">
							Tasks ({todos.length})
						</span>
						<span className="text-xs text-muted-foreground">
							{completedCount} of {todos.length} completed
						</span>
						{inProgressTodo && (
							<span className="text-xs text-blue-500 ml-1 truncate max-w-[200px]">
								{inProgressTodo.activeForm || inProgressTodo.content}
							</span>
						)}
					</div>
				</AccordionTrigger>
				<AccordionContent>
					<div className="space-y-0.5 px-1">
						{todos.map((todo, index) => (
							<TodoItem key={`${todo.content}-${index}`} todo={todo} />
						))}
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
