import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAgentContext } from "@/context/AgentContext";
import { useEffect } from "react";

const formSchema = z.object({
	name: z.string().min(2, {
		message: "Name must be at least 2 characters.",
	}),
	description: z.string().min(2, {
		message: "Description must be at least 2 characters.",
	}),
	systemMessage: z.string().min(2, {
		message: "System message must be at least 2 characters.",
	}),
});

export function AgentCreateForm() {
	const { agent, setAgent } = useAgentContext();
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			description: "",
			systemMessage: "",
		},
	});

	const onSubmit = (values: z.infer<typeof formSchema>) => {
		console.log(values);
	};

	useEffect(() => {
		form.setValue("systemMessage", agent.system);
	}, []);

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Name</FormLabel>
							<FormControl>
								<Input
									placeholder="Agent name"
									{...field}
									onChangeCapture={(e) =>
										setAgent({ ...agent, name: e.currentTarget.value })
									}
								/>
							</FormControl>
							{/* <FormDescription>This is your agent name.</FormDescription> */}
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="description"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Description</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Agent description"
									{...field}
									onChangeCapture={(e) =>
										setAgent({ ...agent, description: e.currentTarget.value })
									}
								/>
							</FormControl>
							{/* <FormDescription>This is your agent description.</FormDescription> */}
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="systemMessage"
					render={({ field }) => (
						<FormItem>
							<FormLabel>System Message</FormLabel>
							<FormControl>
								<Textarea
									{...field}
									onChangeCapture={(e) =>
										setAgent({ ...agent, system: e.currentTarget.value })
									}
								/>
							</FormControl>
							{/* <FormDescription>This is your system message.</FormDescription> */}
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button type="submit">Submit</Button>
			</form>
		</Form>
	);
}
