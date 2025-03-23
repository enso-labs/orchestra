import './styles/globals.css'
import 'highlight.js/styles/github-dark-dimmed.min.css';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppRoutes } from './routes'
import ChatProvider from './context/ChatContext'
import ThemeProvider from './context/ThemeContext'
import ToolProvider from './context/ToolContext';
import AgentProvider from './context/AgentContext';
const Contexts = () => {
  if ('serviceWorker' in navigator) {
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
      <ChatProvider>
        <ToolProvider>
          <AgentProvider>
            <AppRoutes />
          </AgentProvider>
        </ToolProvider>
      </ChatProvider>
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Contexts />
  </StrictMode>,
)
