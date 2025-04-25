import { ConfigCard } from './ConfigCard'

export const ConfigGrid = ({ configs, onSelectConfig, selectedConfig }: { configs: any[], onSelectConfig: (config: any) => void, selectedConfig: any }) => {
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
  )
}
