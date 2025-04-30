import React, { useEffect, useState } from 'react'
import { PlusIcon, MinusIcon } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToolContext } from "@/context/ToolContext";
export const ServerForm = ({ 
  onSubmit, 
  onChange, 
}: { 
  onSubmit: (formData: any) => void, 
  onChange: (formData: any) => void, 
}) => {
  const { formData, setFormData } = useToolContext();
  const [headerKeys, setHeaderKeys] = useState([''])
  useEffect(() => {
    // Initialize header keys from initial data if present
    if (formData?.config?.headers) {
      setHeaderKeys(Object.keys(formData.config.headers))
    }
  }, [formData])
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
          ...formData.config,
          [name]: value,
        },
    }
    setFormData(newFormData)
    onChange?.(newFormData)
  }
  const handleHeaderChange = (key: string, value: string) => {
    const newFormData = {
      ...formData,
      config: {
        ...formData.config,
        headers: {
          ...formData.config.headers,
          [key]: value,
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
      ...formData.config.headers,
    }
    delete newHeaders[headerKeys[index]]
    setHeaderKeys((prev) => prev.filter((_, i) => i !== index))
    setFormData((prev: any) => ({
      ...prev,
      config: {
        ...prev.config,
        headers: newHeaders,
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
          <label className="block mb-2 text-sm font-medium">Server Name</label>
          <Input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="bg-secondary/50 border-border"
            placeholder="Enter server name"
            required
          />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium">Description</label>
          <Textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="bg-secondary/50 border-border resize-none"
            rows={3}
            placeholder="Add a short description about what this server does"
          />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium">Server Type</label>
          <Select
            name="type"
            value={formData.type}
            onValueChange={(value) => {
              handleChange({
                target: { name: 'type', value }
              } as any)
            }}
          >
            <SelectTrigger className="bg-secondary/50 border-border">
              <SelectValue placeholder="Select server type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mcp">MCP</SelectItem>
              <SelectItem value="a2a">A2A</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {formData.type === 'mcp' && (
          <>
            <div>
              <label className="block mb-2 text-sm font-medium">Transport</label>
              <Select
                name="transport"
                value={formData.config.transport}
                onValueChange={(value) => {
                  handleConfigChange({
                    target: { name: 'transport', value }
                  } as any)
                }}
              >
                <SelectTrigger className="bg-secondary/50 border-border">
                  <SelectValue placeholder="Select transport type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sse">SSE</SelectItem>
                  {/* <SelectItem value="websocket">WebSocket</SelectItem> */}
                  {/* <SelectItem value="http">HTTP</SelectItem> */}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium">URL</label>
              <Input
                type="url"
                name="url"
                value={formData.config.url}
                onChange={handleConfigChange}
                className="bg-secondary/50 border-border"
                placeholder="Enter server URL"
                required
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium">Headers</label>
              <div className="space-y-2">
                {headerKeys.map((headerKey, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Header Key"
                      value={headerKey}
                      onChange={(e) => {
                        const newHeaderKeys = [...headerKeys]
                        newHeaderKeys[index] = e.target.value
                        setHeaderKeys(newHeaderKeys)
                      }}
                      className="flex-1 bg-secondary/50 border-border"
                    />
                    <Input
                      type="text"
                      placeholder="Header Value"
                      value={formData.config.headers[headerKey] || ''}
                      onChange={(e) => handleHeaderChange(headerKey, e.target.value)}
                      className="flex-1 bg-secondary/50 border-border"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeHeader(index)}
                      className="h-10 w-10"
                    >
                      <MinusIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              {headerKeys.length < 4 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addHeader}
                  className="mt-2 w-full border-dashed"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Header
                </Button>
              )}
            </div>
          </>
        )}
        {formData.type === 'a2a' && (
          <>
            <div>
              <label className="block mb-2 text-sm font-medium">Base URL</label>
              <Input
                type="url"
                name="url"
                value={formData.config.url}
                onChange={handleConfigChange}
                className="bg-secondary/50 border-border"
                placeholder="Enter base URL"
                required
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium">Agent Card Path</label>
              <Input
                type="text"
                name="agent_card_path"
                value={formData.config.agent_card_path}
                onChange={handleConfigChange}
                className="bg-secondary/50 border-border"
                placeholder="/.well-known/agent.json"
                required
              />
            </div>
          </>
        )}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="public"
            id="public"
            checked={formData.public}
            onChange={handleChange}
            className="h-4 w-4 rounded border-border"
          />
          <label htmlFor="public" className="text-sm">
            Make this configuration public
          </label>
        </div>
      </div>
    </form>
  )
}
