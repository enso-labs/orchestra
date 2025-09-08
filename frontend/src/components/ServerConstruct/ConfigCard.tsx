import { CheckCircleIcon, ServerIcon } from "lucide-react";

interface Config {
	name: string;
	description: string;
	version: string;
	clientInfo: {
		name: string;
	};
	[key: string]: unknown;
}

interface ConfigCardProps {
	config: Config;
	isSelected: boolean;
	onSelect: (config: Config) => void;
}

export const ConfigCard = ({
	config,
	isSelected,
	onSelect,
}: ConfigCardProps) => {
	return (
		<div
			className={`border rounded-lg shadow-sm p-4 cursor-pointer transition-all ${isSelected ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300" : "border-gray-200 hover:border-blue-300 hover:shadow"}`}
			onClick={() => onSelect(config)}
		>
			<div className="flex justify-between items-start mb-2">
				<div className="flex items-center">
					<ServerIcon className="mr-2 text-blue-600" size={20} />
					<h3 className="font-medium text-lg">{config.name}</h3>
				</div>
				{isSelected && <CheckCircleIcon className="text-blue-600" size={20} />}
			</div>
			<p className="text-sm text-gray-600 mb-2">{config.description}</p>
			<div className="flex justify-between text-xs text-gray-500 mt-2">
				<span>Client: {config.clientInfo.name}</span>
				<span>Version: {config.version}</span>
			</div>
		</div>
	);
};
