import { getAuthToken } from '@/lib/utils/auth';
import React from 'react';
import { Navigate } from 'react-router-dom';

interface PublicRouteProps {
  children: React.ReactNode;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const isAuthenticated = Boolean(getAuthToken());

  // Define routes that should be accessible even when authenticated
  const publicRoutes = ['/thread', '/share', '/server'];
  
  // Check if current path starts with any of the public routes
  const isPublicRoute = publicRoutes.some(route => 
    window.location.pathname.startsWith(route)
  );
  
  // Allow access to public routes even when authenticated
  return isAuthenticated && !isPublicRoute ? 
    <Navigate to="/dashboard" /> : 
    <>{children}</>;
};

export default PublicRoute;
