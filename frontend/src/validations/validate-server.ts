import { z } from "zod";
import { Server } from "@/entities";

export const ServerSchema = z.object({
	name: z.string().min(1, "Server name is required"),
	// Add other fields as needed
});


export const validateServer = (server: Server) => {
	const validationResult = ServerSchema.safeParse(server);
	if (!validationResult.success) {
		const errorMessage = validationResult.error.errors.map((err: { path: any; message: any; }) => `${err.path}: ${err.message}`).join(', ');
		return errorMessage;
	}
}		