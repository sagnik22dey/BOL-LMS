import { Outlet, Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const MainLayout = () => {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md shadow-sm h-20 border-b border-surface-dim">
        <div className="flex items-center justify-between px-4 md:px-8 h-full max-w-full mx-auto">
          <div className="flex items-center gap-12">
            {/* Logo: authenticated users go to dashboard, guests stay on home */}
            <RouterLink
              to={isAuthenticated ? '/dashboard' : '/'}
              className="text-2xl font-bold tracking-tighter text-primary font-headline flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-primary text-3xl">school</span>
              BOL-LMS
            </RouterLink>
          </div>

          <div className="flex items-center gap-6">
            {isAuthenticated ? (
              <>
                <RouterLink
                  to="/dashboard"
                  className="text-on-surface-variant hover:text-primary transition-colors duration-200 font-headline font-semibold flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-base">dashboard</span>
                  Dashboard
                </RouterLink>
                <span className="text-on-surface-variant text-sm font-semibold hidden md:block">
                  {user?.name || user?.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-surface-container hover:bg-error hover:text-white text-on-surface px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors border border-surface-dim"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <RouterLink
                  to="/login"
                  className="text-on-surface-variant hover:text-primary transition-colors duration-200 font-headline font-semibold"
                >
                  Sign In
                </RouterLink>
                <RouterLink
                  to="/register"
                  className="bg-primary hover:bg-on-primary-fixed-variant text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                >
                  Get Started
                </RouterLink>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-grow">
        <Outlet />
      </div>

      {/* Footer */}
      <footer className="bg-surface-container-low w-full py-8 border-t border-surface-dim">
        <div className="max-w-7xl mx-auto px-8 flex justify-center text-center items-center">
          <p className="font-inter text-xs tracking-wide text-on-surface-variant">
            © {new Date().getFullYear()} BOL-LMS. Enterprise Learning Platform.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
