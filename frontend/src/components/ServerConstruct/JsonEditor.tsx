import { useEffect, useState } from 'react'
import { SaveIcon } from 'lucide-react'
export const JsonEditor = ({ config }: { config: any }) => {
  const [jsonValue, setJsonValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (config) {
      try {
        // Format the JSON with 2 space indentation for readability
        setJsonValue(JSON.stringify(config.clientInfo, null, 2))
        setError(null)
      } catch (e) {
        setError('Invalid JSON configuration')
      }
    } else {
      setJsonValue('')
    }
  }, [config])
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonValue(e.target.value)
    try {
      JSON.parse(e.target.value)
      setError(null)
    } catch (e) {
      setError('Invalid JSON format')
    }
  }
  const handleSave = () => {
    if (!error) {
      alert('Configuration saved!')
      // Here you would typically send the updated config to your backend
    }
  }
  return (
    <div className="bg-white p-4 rounded-lg shadow h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">JSON Configuration</h2>
        <button
          className={`flex items-center px-3 py-1 rounded ${!config || error ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          disabled={!config || error !== null}
          onClick={handleSave}
        >
          <SaveIcon size={16} className="mr-1" />
          Save
        </button>
      </div>
      {!config ? (
        <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500">Select a configuration to edit</p>
        </div>
      ) : (
        <>
          <textarea
            className={`w-full h-64 font-mono p-3 border rounded-lg ${error ? 'border-red-500' : 'border-gray-300'}`}
            value={jsonValue}
            onChange={handleChange}
            placeholder="Select a configuration to view and edit JSON"
          />
          {error && <p className="text-red-500 mt-2">{error}</p>}
        </>
      )}
    </div>
  )
}
