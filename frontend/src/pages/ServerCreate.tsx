import TwoColumnLayout from "@/layouts/TwoColumnLayout";
import LeftPanelLayout from "@/layouts/LeftPanelLayout";
import { ServerForm } from "@/components/ServerConstruct/ServerForm";
import { highlight, languages } from 'prismjs';
import Editor from "react-simple-code-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToolContext } from "@/context/ToolContext";		
import { useNavigate } from "react-router-dom";
import { Server } from "@/entities";
import { createServer } from "@/services/serverService";
import { useEffect, useState } from "react";
import { INIT_SERVER_STATE } from "@/hooks/useServerHook";

function LeftPanel({
	onCreate,
	loading,
	error,
	handleSubmit,
	handleFormChange,
	title = "New Enso",
	status = "Draft",
}: {
	onCreate: () => void;
	loading: boolean;
	error: string;
	formData: Server;
	handleSubmit: (data: Server) => void;
	handleFormChange: (data: Server) => void;
	title?: string;
	status?: string;
}) {

	
	return (
		<LeftPanelLayout
			title={title}
			status={status}
			onCreate={onCreate}
			loading={loading}
		>
			
			{error && (
				<div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-600">
					{error}
				</div>
			)}
			<ServerForm
				onSubmit={handleSubmit}
				onChange={handleFormChange}
			/>
		</LeftPanelLayout>
	)
}

function ServerCreate() {
	const navigate = useNavigate();
	const {
		code,
		setCode,
		isJsonValid,
		error,
		formData,
		setFormData,
		setError,
		handleFormChange,
		useDefaultServerConfigEffect,
		useJsonValidationEffect,
		useFormHandlerEffect,
		// resetFormData,
	} = useToolContext();

	const [loading, setLoading] = useState(false);
	const handleSubmit = async (data: Server) => {
    try {
      // TODO: Add zod validation
      const response = await createServer(data);
      console.log('Server created:', response);
			// resetFormData();
			alert(`Server created: ${response.data.slug}`);
			navigate(`/server/${response.data.slug}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create server');
    } finally {
			setLoading(false);
		}
  }

	useEffect(() => {
		setFormData(INIT_SERVER_STATE.formData);
	}, []);

	useDefaultServerConfigEffect();
	useJsonValidationEffect();
	useFormHandlerEffect();

  return (
    <TwoColumnLayout
			left={{
				component: (
					<LeftPanel 
						onCreate={() => handleSubmit(formData)} 
						loading={loading} 
						title="New Server" 
						status="Draft" 
						error={error}
						formData={formData}
						handleSubmit={handleSubmit}
						handleFormChange={handleFormChange}
					/>
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
