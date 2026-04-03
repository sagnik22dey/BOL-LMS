import React, { useState, useEffect } from 'react';
import { useUserStore } from '../../store/userStore';
import { useAuthStore } from '../../store/authStore';
import { useOrgStore } from '../../store/orgStore';
import { useCourseStore } from '../../store/courseStore';
import { useCourseBundleStore } from '../../store/courseBundleStore';

const roleConfig = {
  admin: { label: 'Admin', cls: 'badge-info' },
  user: { label: 'User', cls: 'badge-success' },
  super_admin: { label: 'Super Admin', cls: 'badge-error' },
};

const inputClass = "w-full px-3 py-2 border border-[var(--outline)] rounded-xl bg-[var(--surface-low)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all";

const UserRow = ({ u, onSuspend, onDelete, onAssignCourses, loading }) => {
  const conf = roleConfig[u.role] || roleConfig.user;
  return (
    <tr className="hover:bg-[var(--surface)] transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {u.name?.charAt(0)?.toUpperCase() || u.email?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">{u.name || '—'}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{u.email}</td>
      <td className="px-4 py-3">
        <span className={`badge ${conf.cls}`}>{conf.label}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`badge ${u.is_suspended ? 'badge-error' : 'badge-success'}`}>
          {u.is_suspended ? 'Suspended' : 'Active'}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{new Date(u.created_at).toLocaleDateString()}</td>
      <td className="px-4 py-3">
        <div className="flex gap-2 justify-end">
          {u.role === 'user' && onAssignCourses && (
            <button
              onClick={() => onAssignCourses(u)}
              disabled={loading}
              className="text-xs font-semibold px-3 py-1 rounded-lg text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50 mr-2"
            >
              Courses
            </button>
          )}
          <button
            onClick={() => onSuspend(u.id)}
            disabled={loading}
            className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors disabled:opacity-50 ${u.is_suspended ? 'text-[#1e7e34] hover:bg-[#e6f4ea]' : 'text-[#e65100] hover:bg-[#fff3e0]'}`}
          >
            {u.is_suspended ? 'Activate' : 'Suspend'}
          </button>
          <button
            onClick={() => { if (window.confirm('Delete this user?')) onDelete(u.id); }}
            disabled={loading}
            className="text-xs font-semibold px-3 py-1 rounded-lg text-[#ba1a1a] hover:bg-[#fdecea] transition-colors disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
};

const UsersTable = ({ userList, onSuspend, onDelete, onAssignCourses, loading }) => (
  <>
    {/* Mobile card layout */}
    <div className="flex flex-col gap-3 sm:hidden">
      {userList.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-[var(--text-secondary)]">No users found</p>
      ) : (
        userList.map((u) => {
          const conf = roleConfig[u.role] || roleConfig.user;
          return (
            <div key={u.id} className="bg-[var(--surface-lowest)] rounded-xl border border-[var(--outline)] p-4 space-y-3 shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {u.name?.charAt(0)?.toUpperCase() || u.email?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{u.name || '—'}</p>
                    <p className="text-xs text-[var(--text-secondary)] truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <span className={`badge ${conf.cls}`}>{conf.label}</span>
                  <span className={`badge ${u.is_suspended ? 'badge-error' : 'badge-success'}`}>
                    {u.is_suspended ? 'Suspended' : 'Active'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1 border-t border-[var(--outline)]">
                {u.role === 'user' && onAssignCourses && (
                  <button
                    onClick={() => onAssignCourses(u)}
                    disabled={loading}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50"
                  >
                    Courses
                  </button>
                )}
                <button
                  onClick={() => onSuspend(u.id)}
                  disabled={loading}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${u.is_suspended ? 'text-[#1e7e34] hover:bg-[#e6f4ea]' : 'text-[#e65100] hover:bg-[#fff3e0]'}`}
                >
                  {u.is_suspended ? 'Activate' : 'Suspend'}
                </button>
                <button
                  onClick={() => { if (window.confirm('Delete this user?')) onDelete(u.id); }}
                  disabled={loading}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg text-[#ba1a1a] hover:bg-[#fdecea] transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>

    {/* Desktop table */}
    <div className="data-table-container hidden sm:block">
      <table className="w-full">
        <thead>
          <tr className="bg-[var(--surface-low)] border-b border-[var(--outline)]">
            {['Name', 'Email', 'Role', 'Status', 'Created', 'Actions'].map((h) => (
              <th key={h} className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--outline)]">
          {userList.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">No users found</td>
            </tr>
          ) : (
            userList.map((u) => <UserRow key={u.id} u={u} onSuspend={onSuspend} onDelete={onDelete} onAssignCourses={onAssignCourses} loading={loading} />)
          )}
        </tbody>
      </table>
    </div>
  </>
);

const OrgAccordion = ({ org, children }) => {
  const [open, setOpen] = useState(false);
  const { users } = useUserStore();
  const orgAdmins = users.filter((u) => u.organization_id === org.id && u.role === 'admin');
  const orgUsers = users.filter((u) => u.organization_id === org.id && u.role === 'user');

  return (
    <div className="bg-[var(--surface-lowest)] rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[var(--surface-low)] transition-colors text-left"
      >
        <div className="p-1.5 rounded-lg bg-[#e8f0fe] text-[#1565c0] flex-shrink-0">
          <span className="material-symbols-outlined text-[18px]">business</span>
        </div>
        <span className="font-bold text-[var(--text-primary)] flex-1">{org.name}</span>
        <div className="flex gap-2 items-center">
          <span className="badge badge-info">{orgAdmins.length} Admins</span>
          <span className="badge badge-success">{orgUsers.length} Users</span>
          <span
            className="material-symbols-outlined text-[var(--text-secondary)] text-base transition-transform duration-200"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >expand_more</span>
        </div>
      </button>
      {open && (
        <div className="bg-[var(--surface)] border-t border-[var(--outline)] px-5 pb-5 pt-4">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">admin_panel_settings</span> Administrators
          </p>
          {children({ userList: orgAdmins, isOrg: true })}
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-5 mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">person</span> Users
          </p>
          {children({ userList: orgUsers, isOrg: true })}
        </div>
      )}
    </div>
  );
};

const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--surface-lowest)] rounded-2xl shadow-[var(--shadow-xl)] w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--outline)] sticky top-0 bg-[var(--surface-lowest)] z-10">
          <h3 className="font-bold text-lg text-[var(--text-primary)] font-headline">{title}</h3>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

const Users = () => {
  const { user } = useAuthStore();
  const { users, fetchUsers, createAdmin, createUser, deleteUser, suspendUser, loading, error } = useUserStore();
  const { orgs, fetchOrgs } = useOrgStore();
  const { courses, fetchCourses } = useCourseStore();
  const { assignCourseToUser, revokeCourseFromUser, fetchUserIndividualCourses, loading: bundleLoading } = useCourseBundleStore();

  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', organization_id: '' });
  const [formError, setFormError] = useState('');
  
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedUserForAssign, setSelectedUserForAssign] = useState(null);
  const [userAssignedCourses, setUserAssignedCourses] = useState([]);
  const [selectedNewCourses, setSelectedNewCourses] = useState([]);
  
  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    fetchUsers(user?.role);
    if (isSuperAdmin) fetchOrgs();
    if (user?.role === 'admin') fetchCourses();
  }, [fetchUsers, fetchOrgs, user?.role, isSuperAdmin, fetchCourses]);

  const handleClose = () => {
    setOpen(false);
    setFormData({ name: '', email: '', password: '', organization_id: '' });
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (isSuperAdmin && !formData.organization_id) { setFormError('Organization is required.'); return; }
    const success = isSuperAdmin
      ? await createAdmin(formData)
      : await createUser({ name: formData.name, email: formData.email, password: formData.password });
    if (success) { handleClose(); } else { setFormError(useUserStore.getState().error || 'Failed to create user.'); }
  };

  const handleAssignCoursesClick = async (uRef) => {
    setSelectedUserForAssign(uRef);
    const assigned = await fetchUserIndividualCourses(uRef.id);
    setUserAssignedCourses(assigned || []);
    setSelectedNewCourses([]);
    setAssignModalOpen(true);
  };

  const handleAssignToUser = async () => {
    if (selectedNewCourses.length === 0) return;
    const success = await assignCourseToUser(selectedUserForAssign.id, selectedNewCourses);
    if (success) {
      const assigned = await fetchUserIndividualCourses(selectedUserForAssign.id);
      setUserAssignedCourses(assigned || []);
      setSelectedNewCourses([]);
    }
  };

  const handleRevokeFromUser = async (courseId) => {
    const success = await revokeCourseFromUser(selectedUserForAssign.id, courseId);
    if (success) {
      setUserAssignedCourses(userAssignedCourses.filter(a => a.course_id !== courseId));
    }
  };

  const unassigned = users.filter((u) => !u.organization_id);
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const userCount = users.filter((u) => u.role === 'user').length;
  
  const assignedCourseIds = userAssignedCourses.map(a => a.course_id);
  const availableCourses = courses.filter(c => !assignedCourseIds.includes(c.id));

  return (
    <div>
      <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-extrabold font-headline text-[var(--text-primary)]" style={{ letterSpacing: '-1px' }}>
            {isSuperAdmin ? 'User Management' : 'Users'}
          </h2>
          <p className="text-[var(--text-secondary)] text-sm mt-0.5">
            {isSuperAdmin ? 'Manage all administrators and users across organizations' : 'Manage users and individual course access'}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-bold hover:bg-[var(--primary-dark)] transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          {isSuperAdmin ? 'Create Admin' : 'Add User'}
        </button>
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-[#fdecea] border border-[#f5c6c6] text-[#ba1a1a] text-sm">{error}</div>}
      {loading && <div className="mb-4 h-1 bg-[var(--surface-high)] rounded-full overflow-hidden"><div className="h-full w-1/2 bg-[var(--primary)] rounded-full animate-pulse" /></div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Users', value: users.length, icon: 'people', color: '#0058bc' },
          { label: 'Admins', value: adminCount, icon: 'admin_panel_settings', color: '#7b1fa2' },
          { label: 'Learners', value: userCount, icon: 'person', color: '#00897b' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="premium-card p-5 flex items-center gap-3">
            <div className="p-2 rounded-xl flex-shrink-0" style={{ backgroundColor: `${color}18`, color }}>
              <span className="material-symbols-outlined text-xl">{icon}</span>
            </div>
            <div>
              <p className="text-2xl font-extrabold font-headline text-[var(--text-primary)] leading-none" style={{ letterSpacing: '-1px' }}>{value}</p>
              <p className="text-xs font-semibold text-[var(--text-secondary)] mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {isSuperAdmin ? (
        <div className="flex flex-col gap-3">
          {orgs.map((org) => (
            <OrgAccordion key={org.id} org={org}>
              {({ userList }) => <UsersTable userList={userList} onSuspend={suspendUser} onDelete={deleteUser} loading={loading} />}
            </OrgAccordion>
          ))}
          {unassigned.length > 0 && (
            <div className="bg-[var(--surface-lowest)] rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--outline)]">
                <div className="p-1.5 rounded-lg bg-[#fff3e0] text-[#e65100] flex-shrink-0">
                  <span className="material-symbols-outlined text-[18px]">person</span>
                </div>
                <span className="font-bold text-[var(--text-primary)] flex-1">Unassigned Users</span>
                <span className="badge badge-warning">{unassigned.length}</span>
              </div>
              <div className="p-5">
                <UsersTable userList={unassigned} onSuspend={suspendUser} onDelete={deleteUser} loading={loading} />
              </div>
            </div>
          )}
          {orgs.length === 0 && unassigned.length === 0 && !loading && (
            <div className="text-center py-16 text-[var(--text-secondary)]">
              <span className="material-symbols-outlined text-5xl opacity-20 block mb-3">people</span>
              <p className="font-semibold text-base">No users found</p>
            </div>
          )}
        </div>
      ) : (
        <UsersTable userList={users} onSuspend={suspendUser} onDelete={deleteUser} onAssignCourses={handleAssignCoursesClick} loading={loading} />
      )}

      <Modal open={open} onClose={handleClose} title={isSuperAdmin ? 'Create Administrator' : 'Add User'}>
        {formError && <div className="mb-4 px-4 py-3 rounded-xl bg-[#fdecea] border border-[#f5c6c6] text-[#ba1a1a] text-sm">{formError}</div>}
        {!isSuperAdmin && <div className="mb-4 px-4 py-3 rounded-xl bg-[#e8f0fe] border border-[#c5d4f7] text-[#1565c0] text-sm">User will be assigned to your organization.</div>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-[var(--text-primary)]">Full Name</label>
            <input required className={inputClass} placeholder="Jane Smith" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-[var(--text-primary)]">Email Address</label>
            <input required type="email" className={inputClass} placeholder="jane@company.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-[var(--text-primary)]">Password</label>
            <input required type="password" className={inputClass} placeholder="••••••••" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
          </div>
          {isSuperAdmin && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[var(--text-primary)]">Organization</label>
              <select required className={inputClass} value={formData.organization_id} onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}>
                <option value="">Select organization…</option>
                {orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={handleClose} disabled={loading} className="px-4 py-2 rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-high)] transition-colors disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-xl text-sm font-bold bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-60">
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Individual Courses Modal */}
      <Modal open={assignModalOpen} onClose={() => setAssignModalOpen(false)} title={`Manage Courses for ${selectedUserForAssign?.name}`}>
        <div className="flex flex-col gap-5">
          <p className="text-sm text-[var(--text-secondary)] -mt-2">
            Courses assigned here are granted specifically to this user, regardless of their course bundle membership.
          </p>

          <div>
            <h4 className="font-bold text-sm text-[var(--text-primary)] mb-2">Assign New Courses</h4>
            <div className="flex gap-2 items-center">
              <select 
                multiple 
                className={`${inputClass} min-h-[120px]`}
                value={selectedNewCourses}
                onChange={(e) => setSelectedNewCourses(Array.from(e.target.selectedOptions, option => option.value))}
              >
                {availableCourses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                {availableCourses.length === 0 && <option disabled>No available courses left to assign</option>}
              </select>
            </div>
            <button 
                onClick={handleAssignToUser}
                disabled={bundleLoading || selectedNewCourses.length === 0}
                className="mt-2 px-4 py-2 rounded-xl text-sm font-bold bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50"
              >
                Add Selected Courses
            </button>
          </div>

          <div>
            <h4 className="font-bold text-sm text-[var(--text-primary)] mb-2">Directly Assigned Courses</h4>
            {userAssignedCourses.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] bg-[var(--surface-low)] p-3 rounded-xl border border-[var(--outline)]">
                No courses are directly assigned.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--outline)] border border-[var(--outline)] rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {userAssignedCourses.map(assignment => {
                  const c = courses.find(course => course.id === assignment.course_id);
                  return (
                    <li key={assignment.id} className="flex justify-between items-center px-4 py-2.5 hover:bg-[var(--surface-low)] transition-colors">
                      <span className="text-sm text-[var(--text-primary)] font-medium">{c ? c.title : 'Unknown Course'}</span>
                      <button 
                        onClick={() => handleRevokeFromUser(assignment.course_id)}
                        disabled={bundleLoading}
                        className="text-xs text-[#ba1a1a] hover:bg-[#fdecea] px-2 py-1.5 rounded font-semibold transition-colors disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default Users;
