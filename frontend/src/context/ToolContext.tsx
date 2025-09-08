import useToolHook from "@/hooks/useToolHook";
import useMcpHook from "@/hooks/useMcpHook";
import useA2AHook from "@/hooks/useA2AHook";
import useServerHook from "@/hooks/useServerHook";
import { ToolContext } from "@/context/ToolContextDefinition";

export default function ToolProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const mcpHooks = useMcpHook();
	const toolHooks = useToolHook();
	const a2aHooks = useA2AHook();
	const serverHooks = useServerHook();

	return (
		<ToolContext.Provider
			value={{
				...toolHooks,
				...mcpHooks,
				...a2aHooks,
				...serverHooks,
			}}
		>
			{children}
		</ToolContext.Provider>
	);
}
