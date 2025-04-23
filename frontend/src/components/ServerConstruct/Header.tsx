import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { SettingsIcon, PlusIcon } from 'lucide-react'
export const Header = () => {
  const location = useLocation()
  return (
    <header className="bg-blue-600 text-white p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center">
          <SettingsIcon className="mr-2" size={24} />
          <h1 className="text-xl font-bold">MCP Config Marketplace</h1>
        </Link>
        <div className="flex items-center space-x-6">
          <nav>
            <ul className="flex space-x-4">
              <li>
                <Link to="/" className="hover:underline">
                  Configs
                </Link>
              </li>
              <li>
                <button className="hover:underline">Documentation</button>
              </li>
              <li>
                <button className="hover:underline">Support</button>
              </li>
            </ul>
          </nav>
          {location.pathname !== '/create' && (
            <Link
              to="/create"
              className="flex items-center px-3 py-1 bg-white text-blue-600 rounded hover:bg-blue-50"
            >
              <PlusIcon size={16} className="mr-1" />
              New Server
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
