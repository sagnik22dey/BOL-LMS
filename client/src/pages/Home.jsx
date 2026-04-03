import { Link as RouterLink, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const Home = () => {
  const { isAuthenticated, initializing } = useAuthStore();

  // While the session is being restored, render nothing (App.jsx handles the
  // full-page spinner, but this guard is an extra safety net).
  if (initializing) return null;

  // If the user is already logged in, send them straight to their dashboard
  // instead of showing the public landing page.
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="pt-20">
      {/* Hero Section */}
      <section className="relative h-[600px] overflow-hidden flex items-center px-8 lg:px-24">
        <div className="absolute inset-0 z-0 bg-primary-fixed">
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary opacity-90"></div>
        </div>
        <div className="relative z-10 max-w-2xl text-white">
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/20 text-xs font-bold uppercase tracking-widest mb-6">
            Enterprise Learning Platform
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold font-headline leading-[1.1] mb-6 tracking-tight">
            The Platform That Powers Corporate Learning.
          </h1>
          <p className="text-lg text-primary-fixed mb-8 leading-relaxed font-body">
            BOL-LMS delivers a high-performance, frictionless learning experience built for modern enterprises. Manage, deploy, and track learning at scale.
          </p>
          <div className="flex gap-4">
            <RouterLink to="/register" className="bg-white text-primary px-8 py-4 rounded-xl font-bold text-base hover:shadow-xl transition-all">
              Start for Free
            </RouterLink>
            <RouterLink to="/login" className="bg-transparent border border-white/40 text-white px-8 py-4 rounded-xl font-bold text-base hover:bg-white/10 transition-all">
              Sign In
            </RouterLink>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-12 bg-surface-container-low border-b border-surface-dim">
        <div className="max-w-7xl mx-auto px-8">
          <p className="text-center text-xs font-bold text-on-surface-variant uppercase tracking-[0.2em] mb-8">
            Trusted by organizations worldwide
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-60 font-headline font-extrabold text-2xl text-on-surface-variant">
            <span>TechCorp</span>
            <span>GlobalFinance</span>
            <span>EduSolutions</span>
            <span>InnovateTech</span>
          </div>
        </div>
      </section>

      {/* Category Section */}
      <section className="bg-background py-24">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold font-headline text-primary mb-4">Everything You Need to Scale Learning</h2>
            <p className="text-on-surface-variant max-w-xl mx-auto">A unified platform that brings together content delivery, progress tracking, and organizational management.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: 'menu_book', title: 'Structured Paths', desc: 'Curated modules and progressive content.' },
              { icon: 'trending_up', title: 'Progress Analytics', desc: 'Real-time dashboards tracking engagement.' },
              { icon: 'groups', title: 'Multi-Org Management', desc: 'Manage departments from one platform.' },
              { icon: 'verified_user', title: 'Certified Outcomes', desc: 'Issue completion certificates automatically.' }
            ].map((f, i) => (
              <div key={i} className="bg-surface-container-lowest p-8 rounded-3xl text-center hover:bg-primary group transition-all border border-surface-dim shadow-sm">
                <div className="w-16 h-16 bg-surface-container-low rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary-container text-primary flex-shrink-0">
                  <span className="material-symbols-outlined text-3xl group-hover:text-white transition-colors">{f.icon}</span>
                </div>
                <h4 className="font-bold text-lg text-on-surface group-hover:text-white mb-2 transition-colors">{f.title}</h4>
                <p className="text-sm text-on-surface-variant group-hover:text-primary-fixed transition-colors">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 md:px-8">
        <div className="max-w-7xl mx-auto bg-primary rounded-[3rem] p-12 md:p-24 relative overflow-hidden flex flex-col items-center text-center gap-8 shadow-md">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-white rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary-fixed rounded-full blur-3xl"></div>
          </div>
          <div className="relative z-10 text-white max-w-2xl">
            <h2 className="text-4xl md:text-5xl font-extrabold font-headline mb-6 leading-tight">Ready to Transform Your L&D Program?</h2>
            <p className="text-primary-fixed text-lg mb-8 leading-relaxed">Join hundreds of organizations already delivering exceptional learning experiences today.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <RouterLink to="/register" className="bg-white text-primary px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform">
                Get Started Today
              </RouterLink>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Home;
