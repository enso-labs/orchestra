import { ColorModeButton } from '@/components/buttons/ColorModeButton';
import { Link, useNavigate } from 'react-router-dom';
import { MobileNav } from '@/components/nav/MobileNav';
import { TOKEN_NAME } from '@/lib/config';
import useAppHook from '@/lib/hooks/useAppHook';
import HomeIcon from '@/components/icons/HomeIcon';
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { appVersion, useFetchAppVersionEffect } = useAppHook();
  useFetchAppVersionEffect();

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_NAME);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-card border-b border-border">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <HomeIcon />
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-4">
              <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <Link to="/chat" className="text-muted-foreground hover:text-foreground transition-colors">
                Chat
              </Link>
              {/* <Link to="/collections" className="text-muted-foreground hover:text-foreground transition-colors">
                Collections
              </Link> */}
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
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-muted-foreground text-xs">
            &copy; 2025 Ensō. All rights reserved. v{appVersion}
          </p>
        </div>
      </footer>
    </div>
  );
}
