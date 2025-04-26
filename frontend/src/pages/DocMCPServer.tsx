import NoAuthLayout from '../layouts/NoAuthLayout';
import { ColorModeButton } from '@/components/buttons/ColorModeButton';
import { Link, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useToolContext } from '@/context/ToolContext';
import MCPInfo from '@/components/ToolSelector/MCPEditor/mcp-info';
import { getServerInfo } from '@/services/toolService';

export default function DocMCPServer() {
	const { serverSlug } = useParams();
	const { mcpServers, useMCPServersEffect, mcpInfo, setMcpInfo } = useToolContext();

	useMCPServersEffect();

	const server = mcpServers.find((server: any) => server.slug === serverSlug);

	const fetchServerInfo = async () => {
		const res = await getServerInfo('mcp', {mcp: {[server.slug]: server.config}});
		console.log(res.data.mcp);
		setMcpInfo(res.data.mcp);
	}

	useEffect(() => {
		if (server) {
			fetchServerInfo();
		}
	}, [server]);

	
	return (
		<NoAuthLayout>
			<main className="flex-1 flex flex-col items-center justify-center bg-background">
				<div className="absolute top-4 left-4">
					<Link 
						to="/login" 
						className="text-muted-foreground hover:text-primary transition-colors duration-200 text-sm font-medium"
					>
							Login
					</Link>
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
