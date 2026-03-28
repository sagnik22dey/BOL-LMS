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
  const { orgs, unassignedUsers, fetchOrgs, fetchUnassignedUsers, createOrg, updateOrg, assignUserToOrg, loading, error } = useOrgStore();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', slug: '' });
  const [formError, setFormError] = useState('');

  const [editOrgId, setEditOrgId] = useState(null);
  const [assignData, setAssignData] = useState({ user_id: '', role: 'user' });
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');

  useEffect(() => {
    fetchOrgs();
    fetchUnassignedUsers();
  }, [fetchOrgs, fetchUnassignedUsers]);

  const handleOpen = () => {
    setEditOrgId(null);
    setFormData({ name: '', slug: '' });
    setFormError('');
    setAssignError('');
    setAssignSuccess('');
    setOpen(true);
  };

  const handleEditClick = (org) => {
    setEditOrgId(org.id);
    setFormData({ name: org.name, slug: org.slug });
    setFormError('');
    setAssignError('');
    setAssignSuccess('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setFormData({ name: '', slug: '' });
    setFormError('');
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

  const handleAssignSubmit = async () => {
    setAssignError('');
    setAssignSuccess('');
    if (!assignData.user_id) { setAssignError('Please select a user'); return; }
    const success = await assignUserToOrg(editOrgId, assignData.user_id, assignData.role);
    if (success) {
      setAssignSuccess('User assigned successfully');
      setAssignData({ user_id: '', role: 'user' });
    } else {
      setAssignError(useOrgStore.getState().error || 'Failed to assign user');
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

      <div className="data-table-container">
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
            <h4 className="font-bold text-[var(--text-primary)] mb-4">Assign User to Organization</h4>
            {assignError && <div className="mb-3 px-4 py-3 rounded-xl bg-[#fdecea] border border-[#f5c6c6] text-[#ba1a1a] text-sm">{assignError}</div>}
            {assignSuccess && <div className="mb-3 px-4 py-3 rounded-xl bg-[#e6f4ea] border border-[#b7dfbe] text-[#1e7e34] text-sm">{assignSuccess}</div>}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-[var(--text-primary)]">Select User</label>
                <select className={inputClass} value={assignData.user_id} onChange={(e) => setAssignData({ ...assignData, user_id: e.target.value })}>
                  <option value="">Select unassigned user…</option>
                  {unassignedUsers.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                  {unassignedUsers.length === 0 && <option disabled>No unassigned users</option>}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-[var(--text-primary)]">Role</label>
                <select className={inputClass} value={assignData.role} onChange={(e) => setAssignData({ ...assignData, role: e.target.value })}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                onClick={handleAssignSubmit}
                disabled={loading || !assignData.user_id}
                className="w-full py-2.5 rounded-xl text-sm font-bold bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50"
              >
                Assign to Organization
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Organizations;
