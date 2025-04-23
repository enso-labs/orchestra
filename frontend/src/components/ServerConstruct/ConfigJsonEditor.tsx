import React, { useEffect, useState } from 'react'

export const ConfigJsonEditor = ({ data, onChange }: { data: any, onChange: (data: any) => void }) => {
  const [jsonValue, setJsonValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    try {
      const formatted = JSON.stringify(data, null, 2)
      setJsonValue(formatted)
      setError(null)
    } catch (e) {
      setError('Invalid JSON configuration')
    }
  }, [data])
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setJsonValue(newValue)
    try {
      const parsed = JSON.parse(newValue)
      setError(null)
      onChange(parsed)
    } catch (e) {
      setError('Invalid JSON format')
    }
  }
  return (
    <div className="h-full flex flex-col">
      <div className="mb-2 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          {error ? (
            <span className="text-red-500">{error}</span>
          ) : (
            'Edit the JSON directly'
          )}
        </div>
      </div>
      <textarea
        className={`flex-1 w-full font-mono text-sm p-4 border rounded-lg ${error ? 'border-red-500' : 'border-gray-200'} bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500`}
        value={jsonValue}
        onChange={handleChange}
        placeholder="Edit JSON configuration..."
        spellCheck="false"
      />
    </div>
  )
}
