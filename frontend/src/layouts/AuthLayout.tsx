import { ColorModeButton } from '@/components/buttons/ColorModeButton';
import { Link, useNavigate } from 'react-router-dom';
import { MobileNav } from '@/components/nav/MobileNav';
import { APP_VERSION, TOKEN_NAME } from '@/config';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_NAME);
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-foreground">Prompt Engineers AI</h1>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-4">
              <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <Link to="/chat" className="text-muted-foreground hover:text-foreground transition-colors">
                Chat
              </Link>
              <Link to="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Logout
              </button>
              <ColorModeButton />
            </nav>

            {/* Mobile Navigation */}
            <MobileNav onLogout={handleLogout} />
          </div>
        </div>
      </header>

      {children}

      <footer className="mt-auto bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-muted-foreground text-sm">
            &copy; 2024 Prompt Engineers AI. All rights reserved. v{APP_VERSION}
          </p>
        </div>
      </footer>
    </div>
  );
}
