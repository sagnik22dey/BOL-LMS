import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useOrgStore } from '../store/orgStore';
import useCartStore from '../store/cartStore';

const DashboardLayout = () => {
  const { user, logout } = useAuthStore();
  const { fetchMyOrg } = useOrgStore();
  const { cart, fetchCart } = useCartStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [myOrg, setMyOrg] = useState(null);
  
  const avatarRef = useRef(null);

  const isCourseView = /^\/dashboard\/learning\/[^/]+$/.test(location.pathname);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setAvatarMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      fetchMyOrg().then(setMyOrg);
    }
  }, [user, fetchMyOrg]);

  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      fetchCart();
    }
  }, [user, fetchCart]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (avatarRef.current && !avatarRef.current.contains(event.target)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

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
    menuItems.push({ text: 'Course Bundles', path: '/dashboard/course-bundles' });
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
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md shadow-sm h-16 border-b border-surface-dim">
        <div className="flex items-center justify-between px-4 md:px-8 h-full max-w-full mx-auto">
          <div className="flex items-center gap-12">
            <RouterLink to="/" className="text-2xl font-bold tracking-tighter text-primary font-headline flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-3xl">school</span>
              <span className="hidden sm:inline">BOL-LMS</span>
            </RouterLink>

            {!isCourseView && (
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
            )}
          </div>

          <div className="flex items-center gap-3">
            {myOrg && (
              <span className="hidden md:inline-block px-3 py-1 bg-surface-container-low border border-surface-dim rounded-full text-xs font-bold text-on-surface-variant tracking-wider uppercase mr-2">
                {myOrg.name}
              </span>
            )}

            {/* Notifications - always accessible via mobile menu */}
            <button className="material-symbols-outlined text-on-surface hover:bg-surface-container-low p-2 rounded-full transition-colors hidden sm:block">notifications</button>
            
            {/* Cart - accessible via mobile menu on small screens */}
            {user?.role === 'user' && (
              <RouterLink to="/dashboard/cart" className="relative p-2 text-on-surface hover:bg-surface-container-low rounded-full transition-colors hidden sm:block">
                <span className="material-symbols-outlined">shopping_cart</span>
                {cart?.items?.length > 0 && (
                  <span className="absolute top-1 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white transform bg-error rounded-full translate-x-1/4 -translate-y-1/4 select-none pointer-events-none">
                    {cart.items.length}
                  </span>
                )}
              </RouterLink>
            )}

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

              {avatarMenuOpen && (
                <div className="absolute top-12 right-0 mt-2 w-56 bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-dim overflow-hidden animate-[fadeInDown_0.15s_ease-out]">
                  <div className="p-4 border-b border-surface-dim/50 bg-surface-bright/50">
                    <p className="font-bold font-headline text-sm">{displayName}</p>
                    <p className="text-xs text-on-surface-variant">{user?.email}</p>
                    {myOrg && <p className="text-xs text-primary font-bold mt-1 uppercase tracking-wider">{myOrg.name}</p>}
                  </div>
                  <div className="p-2 space-y-1">
                    {/* Always show logout in avatar dropdown */}
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

            {/* Hamburger — opens full mobile drawer */}
            <button 
               onClick={() => setMobileMenuOpen(true)}
               className="lg:hidden material-symbols-outlined p-2 hover:bg-surface-container-low rounded-full transition-colors"
               aria-label="Open navigation menu"
            >
              menu
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile Navigation Drawer ── */}
      {/* Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 z-[70] h-full w-72 max-w-[85vw] bg-surface-container-lowest shadow-2xl flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-dim bg-surface-bright/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold font-headline select-none text-lg">
              {userInitial}
            </div>
            <div>
              <p className="font-bold font-headline text-sm leading-tight">{displayName}</p>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">{user?.role?.replace('_', ' ')}</p>
              {myOrg && <p className="text-[10px] text-primary font-bold tracking-wider">{myOrg.name}</p>}
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="material-symbols-outlined p-2 rounded-full hover:bg-surface-container-low transition-colors text-on-surface-variant"
            aria-label="Close menu"
          >
            close
          </button>
        </div>

        {/* Navigation links */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="px-3 py-1 text-[10px] font-black tracking-widest uppercase text-outline mb-2">Navigation</p>
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <RouterLink
                key={item.text}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold font-headline transition-colors ${
                  isActive(item.path)
                    ? 'bg-primary-fixed-dim/30 text-primary'
                    : 'text-on-surface hover:bg-surface-container-low'
                }`}
              >
                {item.text}
                {isActive(item.path) && <span className="material-symbols-outlined text-primary text-base ml-auto">chevron_right</span>}
              </RouterLink>
            ))}
          </nav>

          <div className="h-px bg-surface-dim/40 my-4 mx-2" />

          {/* Notifications & Cart in mobile menu */}
          <p className="px-3 py-1 text-[10px] font-black tracking-widest uppercase text-outline mb-2">Quick Actions</p>
          <div className="space-y-1">
            <button className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-on-surface hover:bg-surface-container-low transition-colors w-full text-left">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">notifications</span>
              Notifications
            </button>

            {user?.role === 'user' && (
              <RouterLink
                to="/dashboard/cart"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-on-surface hover:bg-surface-container-low transition-colors"
              >
                <span className="relative">
                  <span className="material-symbols-outlined text-on-surface-variant text-xl">shopping_cart</span>
                  {cart?.items?.length > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold text-white bg-error rounded-full">
                      {cart.items.length}
                    </span>
                  )}
                </span>
                Cart
                {cart?.items?.length > 0 && (
                  <span className="ml-auto text-xs bg-error text-white rounded-full px-2 py-0.5 font-bold">{cart.items.length} item{cart.items.length !== 1 ? 's' : ''}</span>
                )}
              </RouterLink>
            )}
          </div>
        </div>

        {/* Sign out at bottom */}
        <div className="p-4 border-t border-surface-dim">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 text-sm font-bold text-error hover:bg-error-container/50 rounded-xl transition-colors"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            Sign Out
          </button>
        </div>
      </div>

      {isCourseView ? (
        <main className="pt-16" style={{ height: '100vh' }}>
          <Outlet />
        </main>
      ) : (
        <>
          <main className="pt-16 flex flex-col" style={{ minHeight: '100vh' }}>
            <div className="flex-1 p-4 md:p-8 lg:p-12 animate-[fadeInUp_0.3s_ease-out]">
              <Outlet />
            </div>
          </main>
          <footer className="bg-surface-container-lowest w-full py-8 border-t border-surface-dim">
            <div className="max-w-7xl mx-auto px-8 flex justify-center text-center items-center">
              <p className="font-inter text-xs tracking-wide text-on-surface-variant">© {new Date().getFullYear()} BOL-LMS. Elevating Intellectual Curiosity.</p>
            </div>
          </footer>
        </>
      )}
    </div>
  );
};

export default DashboardLayout;
