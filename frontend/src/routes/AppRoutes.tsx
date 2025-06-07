import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter6Adapter } from 'use-query-params/adapters/react-router-6';
import App from '../App';

// Routes
import PrivateRoute from './PrivateRoute';
import PublicRoute from './PublicRoute';

// Pages
import Home from '../pages/Home';
import NotFound from '../pages/NotFound';
import Dashboard from '../pages/Dashboard';
import Settings from '../pages/Settings';
import Chat from '../pages/Chat';
import Login from '../pages/Login';
import Register from '@/pages/Register';
import OAuthCallback from '@/pages/OAuthCallback';
import AgentChat from '@/pages/AgentChat';
import CreateAgent from '@/pages/CreateAgent';
import AgentUpdate from '@/pages/AgentUpdate';
import ThreadPublic from '@/pages/ThreadPublic';
import SharePublic from '@/pages/SharePublic';
import DocMCPServer from '@/pages/DocMCPServer';
import FlowCreate from '@/pages/FlowCreate';
import ServerCreate from '@/pages/ServerCreate';
import ServerEdit from '@/pages/ServerEdit';
import Server from '@/pages/server';
import Flow from '@/pages/flow';
import DocumentManager from '@/pages/DocumentManager';

const AppRoutes: React.FC = () => {
  return (
    <Router>
      <QueryParamProvider adapter={ReactRouter6Adapter}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<App />}>
            <Route 
              index 
              element={
                <PublicRoute>
                  <Home />
                </PublicRoute>
              } 
            />
            <Route 
              path="login" 
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } 
            />
            <Route 
              path="register" 
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              } 
            />
            <Route 
              path="thread/:threadId" 
              element={
                <PublicRoute>
                  <ThreadPublic />
                </PublicRoute>
              } 
            />
            <Route 
              path="share/:threadId" 
              element={
                <PublicRoute>
                  <SharePublic />
                </PublicRoute>
              } 
            />
            <Route 
              path="server/:serverSlug" 
              element={
                <PublicRoute>
                  <DocMCPServer />
                </PublicRoute>
              } 
            />
            <Route path="auth/:provider/callback" element={<OAuthCallback />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* Private Routes */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/collections"
            element={
              <PrivateRoute>
                <DocumentManager />
              </PrivateRoute>
            }
          />
          <Route
            path="/collections/:collectionId"
            element={
              <PrivateRoute>
                <DocumentManager />
              </PrivateRoute>
            }
          />
          <Route
            path="/servers"
            element={
              <PrivateRoute>
                <Server />
              </PrivateRoute>
            }
          />
          <Route
            path="/workflows"
            element={
              <PrivateRoute>
                <Flow />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <Settings />
              </PrivateRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <PrivateRoute>
                <Chat />
              </PrivateRoute>
            }
          />
          <Route
            path="/agent/create"
            element={
              <PrivateRoute>
                <CreateAgent />
              </PrivateRoute>
            }
          />
          <Route
            path="/server/create"
            element={
              <PrivateRoute>
                <ServerCreate />
              </PrivateRoute>
            }
          />
          <Route
            path="/server/:serverId/edit"
            element={
              <PrivateRoute>
                <ServerEdit />
              </PrivateRoute>
            }
          />
          <Route
            path="/flow/create"
            element={
              <PrivateRoute>
                <FlowCreate />
              </PrivateRoute>
            }
          />
          <Route
            path="/agents/:agentId"
            element={
              <PrivateRoute>
                <AgentChat />
              </PrivateRoute>
            }
          />
          <Route
            path="/agents/:agentId/edit"
            element={
              <PrivateRoute>
                <AgentUpdate />
              </PrivateRoute>
            }
          />
          <Route
            path="/agents/:agentId/threads/:threadId"
            element={
              <PrivateRoute>
                <AgentChat />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </QueryParamProvider>
    </Router>
  );
};

export default AppRoutes;