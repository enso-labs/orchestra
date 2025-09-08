import { useContext } from "react";
import { ToolContext } from "@/context/ToolContextDefinition";

export function useToolContext(): any {
	return useContext(ToolContext);
}
