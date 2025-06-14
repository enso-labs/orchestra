import { useEffect, useState } from "react";
import TwoColumnLayout from "@/layouts/TwoColumnLayout";
import LeftPanelLayout from "@/layouts/LeftPanelLayout";
import { ServerForm } from "@/components/ServerConstruct/ServerForm";
import { highlight, languages } from 'prismjs';
import Editor from "react-simple-code-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToolContext } from "@/context/ToolContext";		
import { useNavigate, useParams } from "react-router-dom";
import { Server } from "@/lib/entities";
import { deleteServer, getServer, updateServer } from "@/lib/services/serverService";
import { base64Compare } from "@/lib/utils/format";
import { validateServer } from "@/validations/validate-server";

function LeftPanel({
	onCreate,
	loading,
	error,
	handleSubmit,
	handleFormChange,
	disabled,
	onDelete,
	onView,
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
	disabled?: boolean;
	onDelete?: () => void;
	onView?: () => void;
}) {

	
	return (
		<LeftPanelLayout
			title={title || "New Server"}
			status={status}
			onCreate={onCreate}
			loading={loading}
			disabled={disabled}
			onDelete={onDelete}
			onView={onView}
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

function ServerEdit() {
	const { serverId } = useParams();
	const navigate = useNavigate();
	const [loading, setLoading] = useState(false);
	const [originalFormData, setOriginalFormData] = useState<Server | null>(null);
	const [dataMatch, setDataMatch] = useState(true);
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
	} = useToolContext();

	const handleSubmit = async (data: Server) => {
    try {
			setLoading(true);
      const validationResult = validateServer(data);
      if (validationResult) {
        setError(validationResult);
        return;
      }
      const response = await updateServer(serverId || formData.id, data);
			alert(`Server updated: ${response.data.slug}`);
			// Refresh the current page to show updated data
			window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Failed to update server');
    } finally {
			setLoading(false);
		}
  }

	useEffect(() => {
		const fetchServer = async () => {
			const response = await getServer(serverId || formData.id);
			setFormData(response.data);
			setOriginalFormData(response.data);
		}
		fetchServer();
	}, [serverId]);

	useEffect(() => {
		const matching = base64Compare(JSON.stringify(formData), JSON.stringify(originalFormData));
		setDataMatch(matching);
	}, [formData]);

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
						title={formData.name} 
						status={dataMatch ? "✅ Published" : "🔴 Draft (unsaved changes)"}
						error={error}
						formData={formData}
						handleSubmit={handleSubmit}
						handleFormChange={handleFormChange}
						disabled={dataMatch}
						onDelete={async () => {
							const confirmed = window.confirm('Are you sure you want to delete this server? This action cannot be undone.');
							if (confirmed) {
								await deleteServer(serverId || formData.id);
								navigate('/servers');
							}
						}}
						onView={() => navigate(`/server/${formData.slug}`)}
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

export default ServerEdit;
