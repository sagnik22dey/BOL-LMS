import { useState } from 'react';
import { Link as RouterLink, useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { registerUser, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  // Already logged in — go straight to the dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const success = await registerUser({ name: form.name, email: form.email, password: form.password });
    setLoading(false);
    if (success) {
      navigate('/dashboard');
    } else {
      setError(useAuthStore.getState().error || 'Registration failed. Please try again.');
    }
  };

  const inputClass = "w-full pl-10 pr-4 py-2.5 border border-[var(--outline)] rounded-xl bg-[var(--surface-low)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all";

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div
        className="hidden md:flex flex-[0_0_45%] flex-col justify-center p-16 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #001f4d 0%, #00418f 40%, #0058bc 80%, #1a6fd8 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 10%, rgba(255,255,255,0.04) 0%, transparent 50%), radial-gradient(circle at 10% 90%, rgba(255,255,255,0.03) 0%, transparent 40%)' }}
        />
        <div className="flex items-center gap-3 mb-10 z-10">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/15">
            <span className="material-symbols-outlined text-white text-xl">school</span>
          </div>
          <span className="text-white font-extrabold text-lg font-headline">BOL-LMS</span>
        </div>
        <div className="z-10">
          <h2 className="text-white font-extrabold font-headline leading-[1.1] tracking-tight mb-4"
            style={{ fontSize: 'clamp(1.8rem, 2.8vw, 2.8rem)', letterSpacing: '-2px' }}>
            Start Your Learning Journey Today
          </h2>
          <p className="text-white/65 text-base leading-relaxed">
            Join thousands of professionals already developing their skills with BOL-LMS. Create your account and access world-class learning resources.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 md:px-12 bg-[var(--surface-lowest)] overflow-y-auto">
        <div className="w-full max-w-[460px] py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold font-headline tracking-tight text-[var(--text-primary)]" style={{ letterSpacing: '-1px' }}>
              Create your account
            </h1>
            <p className="text-[var(--text-secondary)] mt-1.5 text-sm">Fill in your details to get started</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-[#fdecea] border border-[#f5c6c6] text-[#ba1a1a] text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[var(--text-primary)] text-sm font-semibold" htmlFor="name">Full name</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] text-[18px]">person</span>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Jane Smith"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[var(--text-primary)] text-sm font-semibold" htmlFor="reg-email">Email address</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] text-[18px]">mail</span>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[var(--text-primary)] text-sm font-semibold" htmlFor="reg-password">Password</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] text-[18px]">lock</span>
                  <input
                    id="reg-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={form.password}
                    onChange={handleChange}
                    className={inputClass + ' pr-11'}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[var(--text-primary)] text-sm font-semibold" htmlFor="confirm-password">Confirm password</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] text-[18px]">lock</span>
                  <input
                    id="confirm-password"
                    name="confirmPassword"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full py-3 rounded-xl bg-[var(--primary)] text-white font-bold text-sm hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-[var(--text-secondary)] text-sm text-center mt-6">
            Already have an account?{' '}
            <RouterLink to="/login" className="text-[var(--primary)] font-semibold hover:underline">
              Sign in
            </RouterLink>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
