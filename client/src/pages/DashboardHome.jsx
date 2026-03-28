import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import NotificationsFeed from '../components/NotificationsFeed';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const StatCard = ({ icon, label, value, color, change }) => (
  <div className="bg-[var(--surface-lowest)] rounded-2xl p-5 shadow-[var(--shadow-sm)] flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <div className="p-2 rounded-xl" style={{ backgroundColor: `${color}18`, color }}>
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </div>
      {change && (
        <span className="badge badge-success">{change}</span>
      )}
    </div>
    <div>
      <p className="text-3xl font-extrabold font-headline text-[var(--text-primary)] leading-none tracking-tight" style={{ letterSpacing: '-1px' }}>
        {value}
      </p>
      <p className="text-[var(--text-secondary)] text-sm font-medium mt-0.5">{label}</p>
    </div>
  </div>
);

const ProgressBar = ({ name, progress, color }) => (
  <div className="mb-5">
    <div className="flex justify-between items-center mb-1.5">
      <span className="text-sm font-semibold text-[var(--text-primary)]">{name}</span>
      <span className="text-xs font-bold text-[var(--text-secondary)]">{progress}%</span>
    </div>
    <div className="h-2 bg-[var(--surface-high)] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }}
      />
    </div>
  </div>
);

const DashboardHome = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const displayName = user?.name || user?.email || 'User';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API_URL}/dashboard/stats`, { withCredentials: true });
        setStats(res.data);
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div>
      {/* Greeting Banner */}
      <div
        className="mb-8 p-8 rounded-3xl relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #00418f 0%, #0058bc 60%, #1a6fd8 100%)' }}
      >
        <div className="absolute right-[-40px] top-[-40px] w-48 h-48 rounded-full bg-white/4 pointer-events-none" />
        <div className="absolute right-[80px] bottom-[-60px] w-36 h-36 rounded-full bg-white/4 pointer-events-none" />
        <p className="text-white/60 text-xs font-bold uppercase tracking-[0.1em]">{greeting}</p>
        <h2 className="text-white font-extrabold font-headline text-3xl md:text-4xl mt-1 tracking-tight" style={{ letterSpacing: '-1.5px' }}>
          {displayName}
        </h2>
        <p className="text-white/65 mt-2 text-sm">
          {isAdmin
            ? "Here's an overview of your platform's performance today."
            : 'Continue your learning journey and track your progress.'}
        </p>
      </div>

      {/* Admin Stat Cards */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon="people" label="Total Learners" value={stats?.totalLearners || 0} color="#0058bc" />
          <StatCard icon="school" label="Active Courses" value={stats?.activeCourses || 0} color="#00897b" />
          <StatCard icon="check_circle" label="Completions" value={stats?.completions || 0} color="#7b1fa2" />
          <StatCard icon="trending_up" label="Completion Rate" value={`${stats?.completionRate || 0}%`} color="#e65100" />
        </div>
      )}

      {/* User Stat Cards */}
      {!isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard icon="school" label="Enrolled Courses" value={stats?.enrolledCourses || 0} color="#0058bc" />
          <StatCard icon="check_circle" label="Completed" value={stats?.completed || 0} color="#00897b" />
          <StatCard icon="trending_up" label="Avg. Progress" value={`${stats?.avgProgress || 0}%`} color="#7b1fa2" />
        </div>
      )}

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8">
          <div className="bg-[var(--surface-lowest)] rounded-2xl p-6 shadow-[var(--shadow-sm)] h-full">
            <div className="mb-5">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                {isAdmin ? 'Assignments Overview' : 'My Assignments'}
              </h3>
              <p className="text-[var(--text-secondary)] text-sm mt-0.5">
                {isAdmin ? 'Recent assignment progress across the platform' : 'Track your upcoming assignments and submissions'}
              </p>
            </div>
            {stats?.assignments?.length > 0 ? (
              stats.assignments.slice(0, 5).map((assignment, index) => {
                const colors = ['#0058bc', '#00897b', '#7b1fa2', '#e65100', '#d81b60'];
                const color = colors[index % colors.length];
                return (
                  <ProgressBar key={assignment.id} name={assignment.title} progress={assignment.progress} color={color} />
                );
              })
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">No recent assignments found.</p>
            )}
          </div>
        </div>
        <div className="md:col-span-4">
          <NotificationsFeed />
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
