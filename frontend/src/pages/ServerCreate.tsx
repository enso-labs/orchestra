import { useEffect, useState } from "react";
import TwoColumnLayout from "@/layouts/TwoColumnLayout";
import LeftPanelLayout from "@/layouts/LeftPanelLayout";
import { ServerForm } from "@/components/ServerConstruct/ServerForm";
import { useNavigate } from "react-router-dom";
import { highlight, languages } from 'prismjs';
import Editor from "react-simple-code-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";


const defaultMcpCode = `{
  "new-mcp-server": {
    "url": "https://mcp.enso.sh/sse",
    "headers": {
      "x-mcp-key": "your_api_key"
    },
    "transport": "sse"
  }
}`

const defaultA2A2Code = `{
  "new-a2a-server": {
    "base_url": "https://a2a.enso.sh",
    "agent_card_path": "/.well-known/agent.json"
  }
}`

function LeftPanel({
	onCreate,
	isCreating,
	error,
	formData,
	handleSubmit,
	handleFormChange,
	title = "New Enso",
	status = "Draft",
}: {
	onCreate: () => void;
	isCreating: boolean;
	error: string;
	formData: any;
	handleSubmit: (data: any) => void;
	handleFormChange: (data: any) => void;
	title?: string;
	status?: string;
}) {

	
	return (
		<LeftPanelLayout
			title={title}
			status={status}
			onCreate={onCreate}
			isCreating={isCreating}
		>
			
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

function formatServerName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-') // Replace special chars and spaces with dashes
		.replace(/^-+|-+$/g, ''); // Remove leading/trailing dashes
}

function ServerCreate() {
	const [code, setCode] = useState("");
	const [isJsonValid, setIsJsonValid] = useState(true);
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

	useEffect(() => {
		if (formData.type === 'mcp') {
			setCode(defaultMcpCode)
		} else if (formData.type === 'a2a') {
			setCode(defaultA2A2Code)
		}
	}, [formData.type])
	
	useEffect(() => {
		if (code && code !== "") {
			try {
				JSON.parse(code);
				setIsJsonValid(true);
			} catch (e) {
				setIsJsonValid(false);
			}
		}
	}, [code]);

	useEffect(() => {
		if (formData.type === 'mcp') {
			setCode((prevCode: any) => {
				try {
					const formattedName = formatServerName(formData.name);
					const key = formattedName || 'new-mcp-server';
					
					// Create a fresh object with just one key
					const newObj = {
						[key]: {
							url: "https://mcp.enso.sh/sse",
							headers: {
								"x-mcp-key": "your_api_key"
							},
							transport: "sse"
						}
					};
					
					return JSON.stringify(newObj, null, 2);
				} catch (error) {
					console.error('Error updating JSON:', error);
					return prevCode;
				}
			});
		}
	}, [formData.name, formData.type]);

  return (
    <TwoColumnLayout
			left={{
				component: (
					<>
						<LeftPanel 
							onCreate={() => {}} 
							isCreating={false} 
							title="New Server" 
							status="Draft" 
							error={error}
							formData={formData}
							handleSubmit={handleSubmit}
							handleFormChange={handleFormChange}
						/>
					</>
				),
				defaultSize: 50,
				minSize: 30,
			}}
			right={{
				component: (
					<>
						{!isJsonValid && (
							<div className="p-2">
								<Alert variant="destructive" className="py-2">
									{/* <AlertCircle className="h-6 w-6 mb-2" /> */}
									<AlertDescription>Invalid JSON format</AlertDescription>
								</Alert>
							</div>
						)}
						<Editor
							value={code}
							onValueChange={code => setCode(code)}
							highlight={code => highlight(code, languages.json, 'json')}
							padding={16}
							placeholder={code}
							// className={`${styles.editor} ${!isJsonValid ? 'bg-red-50/10' : ''}`}
							style={{
								fontFamily: '"JetBrains Mono", monospace',
								fontSize: 14,
								borderRadius: '0.375rem',
								minHeight: '100%',
							}}
						/>
					</>
				),
				defaultSize: 50,
				minSize: 30,
			}}
			direction="horizontal"
		/>
  );
}

export default ServerCreate;
