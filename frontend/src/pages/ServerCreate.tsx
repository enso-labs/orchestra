import { useState } from "react";
import TwoColumnLayout from "@/layouts/TwoColumnLayout";
import LeftPanelLayout from "@/layouts/LeftPanelLayout";
import { ServerForm } from "@/components/ServerConstruct/ServerForm";
import { useNavigate } from "react-router-dom";
function LeftPanel({
	onCreate,
	isCreating,
	title = "New Enso",
	status = "Draft",
}: {
	onCreate: () => void;
	isCreating: boolean;
	title?: string;
	status?: string;
}) {
	const navigate = useNavigate()
	const [error, setError] = useState('')
	const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'mcp',
    config: {
      default_server: {
        transport: 'sse',
        url: '',
        headers: {},
      },
    },
    public: false,
  })

	const handleSubmit = async (data: any) => {
    try {
      setFormData(data)
      console.log('Creating server:', data)
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Failed to create server')
    }
  }

	const handleFormChange = (data: any) => {
    setFormData(data)
  }
	
	return (
		<LeftPanelLayout
			title={title}
			status={status}
			onCreate={onCreate}
			isCreating={isCreating}
		>
			

			{/* <h3 className="text-xl font-semibold">
				Create New Server Configuration
			</h3>
			<p className="text-sm text-muted-foreground mb-6">
				Create a new server configuration to get started.
			</p> */}
			
			{error && (
				<div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-600">
					{error}
				</div>
			)}
			<ServerForm
				onSubmit={handleSubmit}
				onChange={handleFormChange}
				initialData={formData}
			/>
		</LeftPanelLayout>
	)
}

function ServerCreate() {
  return (
    <TwoColumnLayout
			left={{
				component: (
					<LeftPanel 
						onCreate={() => {}} 
						isCreating={false} 
						title="New Server" 
						status="Draft" 
					/>
				),
				defaultSize: 50,
				minSize: 30,
			}}
			right={{
				component: <div>Right</div>,
				defaultSize: 50,
				minSize: 30,
			}}
			direction="horizontal"
		/>
  );
}

export default ServerCreate;
