import './styles/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppRoutes } from './routes'
import ChatProvider from './context/ChatContext'
import ThemeProvider from './context/ThemeContext'
import ToolProvider from './context/ToolContext';
import AgentProvider from './context/AgentContext';
import FlowProvider from './context/FlowContext';
import AppProvider from './context/AppContext';

const Contexts = () => {
  if ('serviceWorker' in navigator && import.meta.env.MODE === 'production') {
    navigator.serviceWorker.register(
      import.meta.env.MODE === 'production' ? '/sw.js' : '/dev-sw.js?dev-sw',
      { type: import.meta.env.MODE === 'production' ? 'classic' : 'module' }
    ).then(registration => {
      console.log('Service worker registered successfully:', registration);
    }).catch(error => {
      console.error('Service worker registration failed:', error);
    });
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AppProvider>
        <ChatProvider>
          <ToolProvider>
            <AgentProvider>
              <FlowProvider>
                <AppRoutes />
              </FlowProvider>
            </AgentProvider>
          </ToolProvider>
        </ChatProvider>
      </AppProvider>
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Contexts />
  </StrictMode>,
)
