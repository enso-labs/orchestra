import { useFlowContext } from "@/context/FlowContext";

function FlowEditForm() {
	const { node } = useFlowContext();

	return (
		<div className="p-4">
			<h1 className="text-lg font-semibold mb-4">Flow Editor</h1>
			{node && node.id ? (
				<div className="space-y-4">
					<div>
						<h4 className="font-medium">Node ID</h4>
						<p>{node.id}</p>
					</div>
					
					{node.data && (
						<div>
							<h4 className="font-medium">Label</h4>
							<p>{node.data.label}</p>
						</div>
					)}
					
					{node.position && (
						<div>
							<h4 className="font-medium">Position</h4>
							<p>X: {node.position.x}, Y: {node.position.y}</p>
						</div>
					)}
					
					<div>
						<h4 className="font-medium">All Data</h4>
						<pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
							{JSON.stringify(node, null, 2)}
						</pre>
					</div>
				</div>
			) : (
				<p>Select a node to view its details</p>
			)}
		</div>
	)
}

export default FlowEditForm;