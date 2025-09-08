import { ConfigCard } from "./ConfigCard";

interface Config {
	id: string;
	name: string;
	description: string;
	version: string;
	clientInfo: {
		name: string;
	};
	[key: string]: unknown;
}

interface ConfigGridProps {
	configs: Config[];
	onSelectConfig: (config: Config) => void;
	selectedConfig: Config | null;
}

export const ConfigGrid = ({
	configs,
	onSelectConfig,
	selectedConfig,
}: ConfigGridProps) => {
	return (
		<div className="bg-white p-4 rounded-lg shadow">
			<h2 className="text-xl font-semibold mb-4">Available Configurations</h2>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{configs.map((config) => (
					<ConfigCard
						key={config.id}
						config={config}
						isSelected={selectedConfig && selectedConfig.id === config.id}
						onSelect={onSelectConfig}
					/>
				))}
			</div>
		</div>
	);
};
