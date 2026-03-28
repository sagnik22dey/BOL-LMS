import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../../store/authStore';

const StatCard = ({ title, value, icon, bg, color }) => (
  <div className="premium-card p-6 flex items-center gap-4">
    <div className="p-3 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg, color }}>
      <span className="material-symbols-outlined text-2xl">{icon}</span>
    </div>
    <div>
      <p className="text-3xl font-extrabold font-headline text-[var(--text-primary)] leading-none tracking-tight" style={{ letterSpacing: '-1.5px' }}>
        {value}
      </p>
      <p className="text-[var(--text-secondary)] text-sm font-medium mt-0.5">{title}</p>
    </div>
  </div>
);

const OrgAccordion = ({ org }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-[var(--surface-lowest)] rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[var(--surface-low)] transition-colors text-left"
      >
        <div className="p-1.5 rounded-lg bg-[#e8f0fe] text-[#1565c0] flex-shrink-0">
          <span className="material-symbols-outlined text-[18px]">business</span>
        </div>
        <span className="font-bold text-[var(--text-primary)] flex-1" style={{ letterSpacing: '-0.3px' }}>{org.name}</span>
        <div className="flex gap-2 items-center">
          <span className="badge badge-info">{org.admins?.length || 0} Admins</span>
          <span className="badge badge-success">{org.users?.length || 0} Users</span>
          <span
            className="material-symbols-outlined text-[var(--text-secondary)] text-base transition-transform duration-200"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            expand_more
          </span>
        </div>
      </button>

      {open && (
        <div className="bg-[var(--surface)] border-t border-[var(--outline)]">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--outline)]">
            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">admin_panel_settings</span> Administrators
              </p>
              {!org.admins?.length ? (
                <p className="text-sm text-[var(--text-secondary)] italic">No administrators assigned</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {org.admins.map((admin) => (
                    <div key={admin.id} className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#7b1fa2] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {admin.name?.charAt(0) || admin.email?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight">{admin.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{admin.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">person</span> Users
              </p>
              {!org.users?.length ? (
                <p className="text-sm text-[var(--text-secondary)] italic">No users assigned</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {org.users.map((u) => (
                    <div key={u.id} className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#1e7e34] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {u.name?.charAt(0) || u.email?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight">{u.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{u.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Analytics = () => {
  const { token } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await axios.get('http://localhost:8080/api/admin/super/analytics', { headers: { Authorization: `Bearer ${token}` } });
        setData(res.data);
        setError(null);
      } catch { setError('Failed to load analytics.'); }
      finally { setLoading(false); }
    };
    fetch();
  }, [token]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="px-4 py-3 rounded-xl bg-[#fdecea] border border-[#f5c6c6] text-[#ba1a1a] text-sm font-medium">{error}</div>
  );

  return (
    <div>
      <div className="page-header">
        <h2 className="text-2xl">Platform Analytics</h2>
        <p>Organization-wide performance overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <StatCard title="Total Organizations" value={data?.total_organizations || 0} icon="business" bg="#e8f0fe" color="#1565c0" />
        <StatCard title="Total Administrators" value={data?.total_admins || 0} icon="admin_panel_settings" bg="#ede7f6" color="#7b1fa2" />
        <StatCard title="Total Learners" value={data?.total_users || 0} icon="person" bg="#e6f4ea" color="#1e7e34" />
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-bold text-[var(--text-primary)] font-headline" style={{ letterSpacing: '-0.5px' }}>Organization Hierarchy</h3>
        <p className="text-[var(--text-secondary)] text-sm mt-0.5">Click on an organization to see its administrators and users</p>
      </div>

      {!data?.organizations?.length ? (
        <div className="px-4 py-3 rounded-xl bg-[#e8f0fe] border border-[#c5d4f7] text-[#1565c0] text-sm font-medium">No organizations found.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {data.organizations.map((org) => (
            <OrgAccordion key={org.id} org={org} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Analytics;
