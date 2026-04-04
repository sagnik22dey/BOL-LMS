import { useState, useEffect } from 'react';
import { useOrgStore } from '../../store/orgStore';

const inputClass = "w-full px-3 py-2 border border-[var(--outline)] rounded-xl bg-[var(--surface-low)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all";

const Modal = ({ open, onClose, children, title }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--surface-lowest)] rounded-2xl shadow-[var(--shadow-xl)] w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--outline)]">
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

const Organizations = () => {
  const { orgs, fetchOrgs, createOrg, updateOrg, eligibleUsers, fetchEligibleUsers, bulkAssignUsersToOrg, loading, error } = useOrgStore();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', slug: '' });
  const [formError, setFormError] = useState('');

  const [editOrgId, setEditOrgId] = useState(null);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [assignRole, setAssignRole] = useState('user');
  const [userSearch, setUserSearch] = useState('');
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  // Debounced search for eligible users
  useEffect(() => {
    if (!editOrgId) return;
    const timer = setTimeout(() => {
      fetchEligibleUsers(userSearch, assignRole);
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, assignRole, editOrgId]);

  const handleOpen = () => {
    setEditOrgId(null);
    setFormData({ name: '', slug: '' });
    setFormError('');
    setAssignError('');
    setAssignSuccess('');
    setSelectedUserIds([]);
    setAssignRole('user');
    setUserSearch('');
    setOpen(true);
  };

  const handleEditClick = (org) => {
    setEditOrgId(org.id);
    setFormData({ name: org.name, slug: org.slug });
    setFormError('');
    setAssignError('');
    setAssignSuccess('');
    setSelectedUserIds([]);
    setAssignRole('user');
    setUserSearch('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setFormData({ name: '', slug: '' });
    setFormError('');
    setSelectedUserIds([]);
    setAssignRole('user');
    setUserSearch('');
    setAssignError('');
    setAssignSuccess('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.name || !formData.slug) { setFormError('Name and Slug are required'); return; }
    let success = false;
    if (editOrgId) {
      success = await updateOrg(editOrgId, formData);
    } else {
      success = await createOrg(formData);
    }
    if (success) { handleClose(); } else { setFormError(useOrgStore.getState().error || `Failed to ${editOrgId ? 'update' : 'create'} organization`); }
  };

  const handleToggleUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUserIds.length === eligibleUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(eligibleUsers.map((u) => u.id));
    }
  };

  const handleBulkAssign = async () => {
    setAssignError('');
    setAssignSuccess('');
    if (selectedUserIds.length === 0) {
      setAssignError('Please select at least one user.');
      return;
    }
    try {
      const result = await bulkAssignUsersToOrg(editOrgId, selectedUserIds, assignRole);
      const assignedCount = result.assigned?.length || 0;
      const skippedCount = result.skipped?.length || 0;
      setAssignSuccess(
        `Successfully assigned ${assignedCount} user(s).${skippedCount > 0 ? ` ${skippedCount} skipped (already in an organization or invalid).` : ''}`
      );
      setSelectedUserIds([]);
      fetchOrgs(); // refresh org list
    } catch (err) {
      setAssignError(err?.response?.data?.error || 'Failed to assign users.');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-extrabold font-headline text-[var(--text-primary)]" style={{ letterSpacing: '-1px' }}>Organizations</h2>
          <p className="text-[var(--text-secondary)] text-sm mt-0.5">Manage your platform organizations</p>
        </div>
        <button
          onClick={handleOpen}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-bold hover:bg-[var(--primary-dark)] transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Add New Organization
        </button>
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-[#fdecea] border border-[#f5c6c6] text-[#ba1a1a] text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="premium-card p-5 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#e8f0fe] text-[#1565c0]">
            <span className="material-symbols-outlined text-xl">business</span>
          </div>
          <div>
            <p className="text-2xl font-extrabold font-headline text-[var(--text-primary)] leading-none" style={{ letterSpacing: '-1px' }}>{orgs.length}</p>
            <p className="text-xs font-semibold text-[var(--text-secondary)] mt-0.5">Total Organizations</p>
          </div>
        </div>
      </div>

      {/* Mobile card layout */}
      <div className="flex flex-col gap-3 sm:hidden">
        {orgs.length === 0 && !loading ? (
          <p className="px-4 py-6 text-center text-sm text-[var(--text-secondary)]">No organizations found</p>
        ) : (
          orgs.map((org) => (
            <div key={org.id} className="bg-[var(--surface-lowest)] rounded-xl border border-[var(--outline)] p-4 space-y-3 shadow-[var(--shadow-sm)]">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{org.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-lg bg-[var(--surface-high)] text-xs font-mono">{org.slug}</span>
                  <span className="text-xs text-[var(--text-secondary)]">{new Date(org.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-1 border-t border-[var(--outline)]">
                <button
                  onClick={() => handleEditClick(org)}
                  className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg border border-[var(--outline)] text-[var(--text-primary)] hover:bg-[var(--surface-high)] transition-colors"
                >
                  Edit
                </button>
                <button className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg border border-[#f5c6c6] text-[#ba1a1a] hover:bg-[#fdecea] transition-colors">
                  Suspend
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="data-table-container hidden sm:block">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--surface-low)] border-b border-[var(--outline)]">
              {['Name', 'Slug', 'Created', 'Actions'].map((h) => (
                <th key={h} className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--outline)]">
            {orgs.map((org) => (
              <tr key={org.id} className="hover:bg-[var(--surface)] transition-colors">
                <td className="px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">{org.name}</td>
                <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                  <span className="px-2 py-0.5 rounded-lg bg-[var(--surface-high)] text-xs font-mono">{org.slug}</span>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{new Date(org.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleEditClick(org)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--outline)] text-[var(--text-primary)] hover:bg-[var(--surface-high)] transition-colors"
                    >
                      Edit
                    </button>
                    <button className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#f5c6c6] text-[#ba1a1a] hover:bg-[#fdecea] transition-colors">
                      Suspend
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {orgs.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">No organizations found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={handleClose} title={editOrgId ? 'Edit Organization' : 'Create New Organization'}>
        {formError && <div className="mb-4 px-4 py-3 rounded-xl bg-[#fdecea] border border-[#f5c6c6] text-[#ba1a1a] text-sm">{formError}</div>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-[var(--text-primary)]">Organization Name</label>
            <input required name="name" className={inputClass} placeholder="Acme Corp" value={formData.name} onChange={handleChange} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-[var(--text-primary)]">Slug (URL identifier)</label>
            <input required name="slug" className={inputClass} placeholder="acme-corp" value={formData.slug} onChange={handleChange} />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={handleClose} disabled={loading} className="px-4 py-2 rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-high)] transition-colors disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-xl text-sm font-bold bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-60">
              {editOrgId ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>

        {editOrgId && (
          <div className="mt-6 pt-6 border-t border-[var(--outline)]">
            <h4 className="text-base font-semibold text-[var(--text-primary)] mb-4">
              Assign Users to Organization
            </h4>

            {assignError && (
              <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
                {assignError}
              </div>
            )}
            {assignSuccess && (
              <div className="mb-3 p-3 rounded-lg bg-green-50 text-green-700 text-sm border border-green-200">
                {assignSuccess}
              </div>
            )}

            {/* Role Selector */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Role
              </label>
              <select
                value={assignRole}
                onChange={(e) => {
                  setAssignRole(e.target.value);
                  setSelectedUserIds([]);
                  setUserSearch('');
                }}
                className="w-full p-2.5 rounded-xl border border-[var(--outline)] bg-[var(--surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              {assignRole === 'admin' && (
                <p className="mt-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠️ Admins can only belong to one organization. Only users without an existing organization will be shown.
                </p>
              )}
            </div>

            {/* Search Bar */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Search Users
              </label>
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full p-2.5 rounded-xl border border-[var(--outline)] bg-[var(--surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>

            {/* User List with Checkboxes */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  Select Users
                </label>
                {eligibleUsers.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs text-[var(--primary)] hover:underline"
                  >
                    {selectedUserIds.length === eligibleUsers.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
              <div className="border border-[var(--outline)] rounded-xl overflow-hidden">
                {eligibleUsers.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)] text-center py-6 px-4">
                    {userSearch ? 'No users match your search.' : 'No eligible users found.'}
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto divide-y divide-[var(--outline)]">
                    {eligibleUsers.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[var(--surface-hover,#f5f5f5)] transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.id)}
                          onChange={() => handleToggleUser(user.id)}
                          className="w-4 h-4 rounded border-[var(--outline)] text-[var(--primary)] focus:ring-[var(--primary)]"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {user.name}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)] truncate">{user.email}</p>
                        </div>
                        {user.organization_id && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full shrink-0">
                            In org
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {selectedUserIds.length > 0 && (
                <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                  {selectedUserIds.length} user(s) selected
                </p>
              )}
            </div>

            {/* Assign Button */}
            <button
              onClick={handleBulkAssign}
              disabled={selectedUserIds.length === 0}
              className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Assign {selectedUserIds.length > 0 ? `(${selectedUserIds.length})` : ''} to Organization
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Organizations;
