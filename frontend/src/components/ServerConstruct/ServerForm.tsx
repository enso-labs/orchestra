import React, { useEffect, useState } from 'react'
import { PlusIcon, MinusIcon } from 'lucide-react'

export const ServerForm = ({ onSubmit, onChange, initialData }: { onSubmit: (formData: any) => void, onChange: (formData: any) => void, initialData: any }) => {
  const [formData, setFormData] = useState(initialData)
  const [headerKeys, setHeaderKeys] = useState([''])
  useEffect(() => {
    // Initialize header keys from initial data if present
    if (initialData?.config?.default_server?.headers) {
      setHeaderKeys(Object.keys(initialData.config.default_server.headers))
    }
  }, [initialData])
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    // Need to handle checkbox separately as it doesn't have a value property in the same way
    const isCheckbox = type === 'checkbox';
    const targetValue = isCheckbox ? (e.target as HTMLInputElement).checked : value;

    const newFormData = {
      ...formData,
      [name]: targetValue,
    }
    setFormData(newFormData)
    onChange?.(newFormData)
  }
  const handleConfigChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target
    const newFormData = {
      ...formData,
      config: {
        default_server: {
          ...formData.config.default_server,
          [name]: value,
        },
      },
    }
    setFormData(newFormData)
    onChange?.(newFormData)
  }
  const handleHeaderChange = (key: string, value: string) => {
    const newFormData = {
      ...formData,
      config: {
        default_server: {
          ...formData.config.default_server,
          headers: {
            ...formData.config.default_server.headers,
            [key]: value,
          },
        },
      },
    }
    setFormData(newFormData)
    onChange?.(newFormData)
  }
  const addHeader = () => {
    setHeaderKeys((prev) => [...prev, ''])
  }
  const removeHeader = (index: number) => {
    const newHeaders = {
      ...formData.config.default_server.headers,
    }
    delete newHeaders[headerKeys[index]]
    setHeaderKeys((prev) => prev.filter((_, i) => i !== index))
    setFormData((prev: any) => ({
      ...prev,
      config: {
        default_server: {
          ...prev.config.default_server,
          headers: newHeaders,
        },
      },
    }))
  }
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSubmit(formData)
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Server Name
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Server Type
          </label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="mcp">MCP</option>
            <option value="a2a">A2A</option>
          </select>
        </div>
        {formData.type === 'mcp' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transport
              </label>
              <select
                name="transport"
                value={formData.config.default_server.transport}
                onChange={handleConfigChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="sse">SSE</option>
                <option value="websocket">WebSocket</option>
                <option value="http">HTTP</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL
              </label>
              <input
                type="url"
                name="url"
                value={formData.config.default_server.url}
                onChange={handleConfigChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Headers
              </label>
              <div className="space-y-2">
                {headerKeys.map((headerKey, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Header Key"
                      value={headerKey}
                      onChange={(e) => {
                        const newHeaderKeys = [...headerKeys]
                        newHeaderKeys[index] = e.target.value
                        setHeaderKeys(newHeaderKeys)
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Header Value"
                      value={
                        formData.config.default_server.headers[headerKey] || ''
                      }
                      onChange={(e) =>
                        handleHeaderChange(index, headerKey, e.target.value)
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeHeader(index)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <MinusIcon size={20} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addHeader}
                className="mt-2 flex items-center text-sm text-blue-600 hover:text-blue-700"
              >
                <PlusIcon size={16} className="mr-1" />
                Add Header
              </button>
            </div>
          </>
        )}
        {formData.type === 'a2a' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base URL
              </label>
              <input
                type="url"
                name="url"
                value={formData.config.default_server.url}
                onChange={handleConfigChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Agent Card Path
              </label>
              <input
                type="text"
                name="agent_card_path"
                value={formData.config.default_server.agent_card_path}
                onChange={handleConfigChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="/.well-known/agent.json"
                required
              />
            </div>
          </>
        )}
        <div className="flex items-center">
          <input
            type="checkbox"
            name="public"
            id="public"
            checked={formData.public}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="public" className="ml-2 block text-sm text-gray-700">
            Make this configuration public
          </label>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Create Server
        </button>
      </div>
    </form>
  )
}
