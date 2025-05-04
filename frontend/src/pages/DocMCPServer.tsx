import NoAuthLayout from '../layouts/NoAuthLayout';
import { ColorModeButton } from '@/components/buttons/ColorModeButton';
import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useToolContext } from '@/context/ToolContext';
import MCPInfo from '@/components/ToolSelector/MCPEditor/mcp-info';
import { getServerInfo } from '@/services/toolService';
import HomeIcon from '@/components/icons/HomeIcon';
import { useNavigate } from 'react-router-dom';

export default function DocMCPServer() {
	const navigate = useNavigate();
	const { serverSlug } = useParams();
	const { mcpServers, useMCPServersEffect, mcpInfo, setMcpInfo } = useToolContext();

	useMCPServersEffect();
	const server = mcpServers.find((server: any) => server.slug === serverSlug);

	const fetchServerInfo = async () => {
		const res = await getServerInfo('mcp', {mcp: {[server.slug]: server.config}});
		setMcpInfo(res.data.mcp);
	}

	useEffect(() => {
		if (server) {
			fetchServerInfo();
		}
		return () => {
			setMcpInfo(null);
		}
	}, [server]);

	
	return (
		<NoAuthLayout>
			<main className="flex-1 flex flex-col items-center justify-center bg-background">
				<div className="absolute top-4 left-4">
					<HomeIcon onClick={() => navigate(-1)} />
				</div>
				<div className="absolute top-4 right-4">
					<ColorModeButton />
				</div>

				{server && (
					<div className="max-w-3xl mx-auto px-4 py-6">
						<h1 className="text-2xl font-bold text-center">{server.name}</h1>
						<p className="text-muted-foreground text-center">{server.description}</p>
					</div>
				)}

				{mcpInfo && (
					<div className="max-w-3xl mx-auto px-4 py-6">
						<MCPInfo />
					</div>
				)}
			</main>
		</NoAuthLayout>
	);
}
