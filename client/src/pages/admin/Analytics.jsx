import { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import { useCourseStore } from '../../store/courseStore';

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

const UserCourseRow = ({ user }) => {
  const [open, setOpen] = useState(false);
  const hasCourses = user.assigned_courses?.length > 0;

  return (
    <div className="border border-[var(--outline)] rounded-xl overflow-hidden">
      <button
        onClick={() => hasCourses && setOpen(!open)}
        className={`w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors ${hasCourses ? 'hover:bg-[var(--surface-low)] cursor-pointer' : 'cursor-default'}`}
      >
        <div className="w-7 h-7 rounded-full bg-[#1e7e34] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {user.name?.charAt(0) || user.email?.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight truncate">{user.name}</p>
          <p className="text-xs text-[var(--text-secondary)] truncate">{user.email}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasCourses ? (
            <span className="badge badge-success">{user.assigned_courses.length} Course{user.assigned_courses.length !== 1 ? 's' : ''}</span>
          ) : (
            <span className="text-xs text-[var(--text-secondary)] italic">No courses</span>
          )}
          {hasCourses && (
            <span
              className="material-symbols-outlined text-[var(--text-secondary)] text-base transition-transform duration-200"
              style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              expand_more
            </span>
          )}
        </div>
      </button>

      {open && hasCourses && (
        <div className="border-t border-[var(--outline)] bg-[var(--surface)] px-4 py-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--text-secondary)] uppercase tracking-wider">
                <th className="text-left pb-2 font-bold">Course</th>
                <th className="text-left pb-2 font-bold">Source</th>
                <th className="text-left pb-2 font-bold">Progress</th>
                <th className="text-left pb-2 font-bold">Status</th>
                <th className="text-left pb-2 font-bold">Assigned On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--outline)]">
              {user.assigned_courses.map((ac) => (
                <tr key={ac.course_id} className="text-[var(--text-primary)]">
                  <td className="py-2 pr-3 font-medium max-w-[160px]">
                    <span className="block truncate" title={ac.course_title}>{ac.course_title}</span>
                  </td>
                  <td className="py-2 pr-3">
                    {ac.source === 'assignment' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e8f0fe] text-[#1565c0] font-bold text-[10px]">
                        <span className="material-symbols-outlined text-[10px]">admin_panel_settings</span>
                        Assigned
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e6f4ea] text-[#1e7e34] font-bold text-[10px]">
                        <span className="material-symbols-outlined text-[10px]">school</span>
                        Self-enrolled
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-20 h-1.5 bg-[var(--outline)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#1e7e34]"
                          style={{ width: `${Math.min(Math.round(ac.progress), 100)}%` }}
                        />
                      </div>
                      <span className="text-[var(--text-secondary)]">{Math.round(ac.progress)}%</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    {ac.is_enrolled ? (
                      <span className="inline-flex items-center gap-1 text-[#1e7e34] font-semibold">
                        <span className="material-symbols-outlined text-[12px]">check_circle</span>
                        Enrolled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                        <span className="material-symbols-outlined text-[12px]">pending</span>
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-[var(--text-secondary)]">
                    {new Date(ac.assigned_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const OrgAccordion = ({ org }) => {
  const [open, setOpen] = useState(false);
  const totalCourses = (org.users || []).reduce(
    (sum, u) => sum + (u.assigned_courses?.length || 0), 0
  );

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
          {totalCourses > 0 && (
            <span className="badge" style={{ backgroundColor: '#fff3e0', color: '#e65100' }}>
              {totalCourses} Course{totalCourses !== 1 ? 's' : ''} Assigned
            </span>
          )}
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
          {/* Admins section */}
          <div className="p-5 border-b border-[var(--outline)]">
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

          {/* Users + their courses */}
          <div className="p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">person</span> Users &amp; Course Assignments
            </p>
            {!org.users?.length ? (
              <p className="text-sm text-[var(--text-secondary)] italic">No users assigned</p>
            ) : (
              <div className="flex flex-col gap-2">
                {org.users.map((u) => (
                  <UserCourseRow key={u.id} user={u} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Analytics = () => {
  const { token, user } = useAuthStore();
  const { courseDeleteLogs, fetchCourseDeleteLogs } = useCourseStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    if (!token) return;
    // Run both requests in parallel — no need for one to wait on the other
    const loadAll = async () => {
      setLoading(true);
      try {
        const [analyticsRes] = await Promise.all([
          api.get('/api/admin/super/analytics'),
          fetchCourseDeleteLogs(isSuperAdmin),
        ]);
        setData(analyticsRes.data);
        setError(null);
      } catch {
        setError('Failed to load analytics.');
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [token, fetchCourseDeleteLogs, isSuperAdmin]);

  // Memoized: only recalculates when the organizations data changes
  const totalCourseAssignments = useMemo(
    () =>
      data?.organizations?.reduce(
        (sum, org) =>
          sum + (org.users || []).reduce((s, u) => s + (u.assigned_courses?.length || 0), 0),
        0
      ) || 0,
    [data?.organizations]
  );

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard title="Total Organizations" value={data?.total_organizations || 0} icon="business" bg="#e8f0fe" color="#1565c0" />
        <StatCard title="Total Administrators" value={data?.total_admins || 0} icon="admin_panel_settings" bg="#ede7f6" color="#7b1fa2" />
        <StatCard title="Total Learners" value={data?.total_users || 0} icon="person" bg="#e6f4ea" color="#1e7e34" />
        <StatCard title="Course Assignments" value={totalCourseAssignments} icon="school" bg="#fff3e0" color="#e65100" />
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-bold text-[var(--text-primary)] font-headline" style={{ letterSpacing: '-0.5px' }}>Organization Hierarchy</h3>
        <p className="text-[var(--text-secondary)] text-sm mt-0.5">Click on an organization to see administrators, users, and their course assignments</p>
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

      {/* Course Deletion Logs */}
      <div className="mt-10">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-[var(--text-primary)] font-headline flex items-center gap-2" style={{ letterSpacing: '-0.5px' }}>
            <span className="material-symbols-outlined text-red-500">delete_forever</span>
            Course Deletion Logs
          </h3>
          <p className="text-[var(--text-secondary)] text-sm mt-0.5">Audit trail of all courses deleted by administrators</p>
        </div>

        {!courseDeleteLogs?.length ? (
          <div className="px-4 py-3 rounded-xl bg-[var(--surface-lowest)] border border-[var(--outline)] text-[var(--text-secondary)] text-sm font-medium">
            No courses have been deleted yet.
          </div>
        ) : (
          <div className="bg-[var(--surface-lowest)] rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden border border-[var(--outline)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--surface)] border-b border-[var(--outline)]">
                    <th className="text-left px-4 py-3 font-bold text-[var(--text-secondary)] uppercase tracking-wider text-xs">Course</th>
                    <th className="text-left px-4 py-3 font-bold text-[var(--text-secondary)] uppercase tracking-wider text-xs">Deleted By</th>
                    <th className="text-left px-4 py-3 font-bold text-[var(--text-secondary)] uppercase tracking-wider text-xs">Email</th>
                    <th className="text-left px-4 py-3 font-bold text-[var(--text-secondary)] uppercase tracking-wider text-xs">Deleted At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--outline)]">
                  {courseDeleteLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--surface-low)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-red-400 text-[16px]">school</span>
                          <span className="font-semibold text-[var(--text-primary)]">{log.course_title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xs font-bold flex-shrink-0">
                            {log.deleted_by_name?.charAt(0) || '?'}
                          </div>
                          <span className="text-[var(--text-primary)] font-medium">{log.deleted_by_name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{log.deleted_by_email}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {new Date(log.deleted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {' '}
                        <span className="text-xs">
                          {new Date(log.deleted_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
