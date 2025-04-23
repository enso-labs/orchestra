import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ServerForm } from '../components/ServerConstruct/ServerForm'
import { ConfigJsonEditor } from '../components/ServerConstruct/ConfigJsonEditor'
import { FormInputIcon, CodeIcon } from 'lucide-react'
export const CreateServer = () => {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('form')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'mcp',
    config: {
      default_server: {
        transport: 'sse',
        url: '',
        headers: {},
      },
    },
    public: false,
  })
  const handleSubmit = async (data: any) => {
    try {
      setFormData(data)
      console.log('Creating server:', data)
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Failed to create server')
    }
  }
  const handleFormChange = (data: any) => {
    setFormData(data)
  }
  const handleJsonChange = (newData: any) => {
    setFormData(newData)
  }
  return (
    <main className="flex-1 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow">
          <div className="md:hidden">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab('form')}
                  className={`flex-1 px-4 py-3 text-center ${activeTab === 'form' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <FormInputIcon className="inline-block w-5 h-5 mr-2" />
                  Form
                </button>
                <button
                  onClick={() => setActiveTab('json')}
                  className={`flex-1 px-4 py-3 text-center ${activeTab === 'json' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <CodeIcon className="inline-block w-5 h-5 mr-2" />
                  JSON
                </button>
              </nav>
            </div>
          </div>
          <div className="flex flex-col md:flex-row">
            <div
              className={`flex-1 p-6 ${activeTab === 'form' ? 'block' : 'hidden md:block'}`}
            >
              <h1 className="text-2xl font-semibold mb-6">
                Create New Server Configuration
              </h1>
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-600">
                  {error}
                </div>
              )}
              <ServerForm
                onSubmit={handleSubmit}
                onChange={handleFormChange}
                initialData={formData}
              />
            </div>
            <div
              className={`flex-1 border-t md:border-t-0 md:border-l border-gray-200 ${activeTab === 'json' ? 'block' : 'hidden md:block'}`}
            >
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-6">
                  JSON Configuration
                </h2>
                <ConfigJsonEditor data={formData} onChange={handleJsonChange} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
