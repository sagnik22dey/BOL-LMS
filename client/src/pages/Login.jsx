import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const FEATURES = [
  'Multi-organization course management',
  'Real-time learner progress analytics',
  'Automated certification & compliance',
];

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuthStore();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const success = await loginUser(form.email, form.password);
    setLoading(false);
    if (success) {
      navigate('/dashboard');
    } else {
      setError(useAuthStore.getState().error || 'Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div
        className="hidden md:flex flex-[0_0_55%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #001f4d 0%, #00418f 40%, #0058bc 70%, #1a6fd8 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.04) 0%, transparent 40%)' }}
        />
        <div className="flex items-center gap-3 z-10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/15">
            <span className="material-symbols-outlined text-white text-xl">school</span>
          </div>
          <span className="text-white font-extrabold text-lg font-headline">BOL-LMS</span>
        </div>

        <div className="z-10">
          <h2 className="text-white font-extrabold font-headline leading-[1.1] tracking-tight mb-4"
            style={{ fontSize: 'clamp(2rem, 3.2vw, 3.2rem)', letterSpacing: '-2px' }}>
            Empower Your Organization's Learning
          </h2>
          <p className="text-white/65 text-base leading-relaxed mb-8 max-w-xl">
            A corporate-grade learning platform built for modern enterprises. Deploy, manage, and scale learning programs with confidence.
          </p>
          <div className="flex flex-col gap-3">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#adc6ff] text-lg">check_circle</span>
                <span className="text-white/85 font-medium text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-8 z-10">
          {[['50K+', 'Active Learners'], ['2,400+', 'Courses'], ['98%', 'Completion Rate']].map(([v, l]) => (
            <div key={l}>
              <p className="text-white font-extrabold text-2xl font-headline">{v}</p>
              <p className="text-white/50 text-xs font-medium">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 md:px-12 bg-[var(--surface-lowest)]">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold font-headline tracking-tight text-[var(--text-primary)]" style={{ letterSpacing: '-1px' }}>
              Welcome back
            </h1>
            <p className="text-[var(--text-secondary)] mt-1.5 text-sm">Sign in to your account to continue</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-[#fdecea] border border-[#f5c6c6] text-[#ba1a1a] text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[var(--text-primary)] text-sm font-semibold" htmlFor="email">Email address</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] text-[18px]">mail</span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 border border-[var(--outline)] rounded-xl bg-[var(--surface-low)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[var(--text-primary)] text-sm font-semibold" htmlFor="password">Password</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] text-[18px]">lock</span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-11 py-2.5 border border-[var(--outline)] rounded-xl bg-[var(--surface-low)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
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
              <div className="text-right">
                <span className="text-xs font-semibold text-[var(--primary)] cursor-pointer hover:underline">Forgot password?</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full py-3 rounded-xl bg-[var(--primary)] text-white font-bold text-sm hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-[var(--text-secondary)] text-sm text-center mt-6">
            Don't have an account?{' '}
            <RouterLink to="/register" className="text-[var(--primary)] font-semibold hover:underline">
              Create one
            </RouterLink>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
