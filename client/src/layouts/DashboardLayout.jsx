import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useOrgStore } from '../store/orgStore';

const DashboardLayout = () => {
  const { user, logout } = useAuthStore();
  const { fetchMyOrg } = useOrgStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [myOrg, setMyOrg] = useState(null);
  
  const avatarRef = useRef(null);

  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      fetchMyOrg().then(setMyOrg);
    }
  }, [user, fetchMyOrg]);

  // Click outside to close avatar menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (avatarRef.current && !avatarRef.current.contains(event.target)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const menuItems = [
    { text: 'Dashboard', path: '/dashboard' },
  ];

  if (user?.role === 'super_admin') {
    menuItems.push({ text: 'Analytics', path: '/dashboard/analytics' });
    menuItems.push({ text: 'Organizations', path: '/dashboard/organizations' });
    menuItems.push({ text: 'All Users', path: '/dashboard/users' });
  } else if (user?.role === 'admin') {
    menuItems.push({ text: 'Courses', path: '/dashboard/courses' });
    menuItems.push({ text: 'Users', path: '/dashboard/users' });
    menuItems.push({ text: 'Groups', path: '/dashboard/groups' });
  } else {
    menuItems.push({ text: 'My Learning', path: '/dashboard/learning' });
    menuItems.push({ text: 'Courses', path: '/dashboard/courses' });
  }

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U';
  const displayName = user?.name || user?.email || 'User';

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="bg-background text-on-surface font-body min-h-screen selection:bg-primary-container selection:text-on-primary-container">
      {/* Top NavBar */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md shadow-sm h-20 border-b border-surface-dim">
        <div className="flex items-center justify-between px-4 md:px-8 h-full max-w-full mx-auto">
          <div className="flex items-center gap-12">
            <RouterLink to="/" className="text-2xl font-bold tracking-tighter text-primary font-headline flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-3xl">school</span>
              <span className="hidden sm:inline">BOL-LMS</span>
            </RouterLink>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-8 font-headline text-sm font-semibold tracking-tight">
              {menuItems.map((item) => (
                <RouterLink 
                  key={item.text} 
                  to={item.path}
                  className={`transition-colors duration-200 pb-1 ${isActive(item.path) ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-primary'}`}
                >
                  {item.text}
                </RouterLink>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {myOrg && (
              <span className="hidden md:inline-block px-3 py-1 bg-surface-container-low border border-surface-dim rounded-full text-xs font-bold text-on-surface-variant tracking-wider uppercase mr-2">
                {myOrg.name}
              </span>
            )}

            <button className="material-symbols-outlined text-on-surface hover:bg-surface-container-low p-2 rounded-full transition-colors hidden sm:block">notifications</button>
            
            {/* User Dropdown */}
            <div className="relative" ref={avatarRef}>
              <button 
                onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
                className="flex items-center gap-2 hover:bg-surface-container-low p-1 pr-3 rounded-full transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold font-headline select-none">
                  {userInitial}
                </div>
                <div className="hidden md:flex flex-col items-start px-1 text-left">
                  <span className="text-sm font-bold font-headline leading-tight">{displayName}</span>
                  <span className="text-[10px] text-on-surface-variant leading-tight uppercase font-bold tracking-wider">{user?.role?.replace('_', ' ')}</span>
                </div>
                <span className="material-symbols-outlined text-sm text-outline hidden md:block">expand_more</span>
              </button>

              {/* Dropdown Menu */}
              {avatarMenuOpen && (
                <div className="absolute top-12 right-0 mt-2 w-56 bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-dim overflow-hidden animate-[fadeInDown_0.15s_ease-out]">
                  <div className="p-4 border-b border-surface-dim/50 bg-surface-bright/50">
                    <p className="font-bold font-headline text-sm">{displayName}</p>
                    <p className="text-xs text-on-surface-variant">{user?.email}</p>
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="block lg:hidden">
                      <p className="px-3 py-1 text-[10px] font-black tracking-widest uppercase text-outline mt-1 mb-1">Navigation</p>
                      {menuItems.map((item) => (
                        <RouterLink 
                          key={item.text} 
                          to={item.path}
                          onClick={() => setAvatarMenuOpen(false)}
                          className={`block px-3 py-2 rounded-lg text-sm font-bold font-headline transition-colors ${isActive(item.path) ? 'bg-primary-fixed-dim/30 text-primary' : 'text-on-surface hover:bg-surface-container-low'}`}
                        >
                          {item.text}
                        </RouterLink>
                      ))}
                      <div className="h-px bg-surface-dim/40 my-2 mx-2"></div>
                    </div>
                    
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-error hover:bg-error-container/50 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">logout</span>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button 
               onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
               className="lg:hidden material-symbols-outlined p-2 hover:bg-surface-container-low rounded-full transition-colors"
            >
              menu
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20 min-h-screen">
        <div className="p-4 md:p-8 lg:p-12 animate-[fadeInUp_0.3s_ease-out]">
          <Outlet />
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-surface-container-lowest w-full py-8 border-t border-surface-dim">
        <div className="max-w-7xl mx-auto px-8 flex justify-center text-center items-center">
          <p className="font-inter text-xs tracking-wide text-on-surface-variant">© {new Date().getFullYear()} BOL-LMS. Elevating Intellectual Curiosity.</p>
        </div>
      </footer>
    </div>
  );
};

export default DashboardLayout;
