import { useState, useEffect } from 'react';
import { useOrgStore } from '../../store/orgStore';

export default function MyOrganization() {
  const {
    myOrg,
    fetchMyOrg,
    adminOrgUsers,
    adminEligibleUsers,
    fetchAdminOrgUsers,
    fetchAdminEligibleUsers,
    adminBulkAssignUsers,
  } = useOrgStore();

  const [showAddUsers, setShowAddUsers] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');

  useEffect(() => {
    fetchMyOrg();
    fetchAdminOrgUsers();
  }, []);

  // Debounced search for eligible users
  useEffect(() => {
    if (!showAddUsers) return;
    const timer = setTimeout(() => {
      fetchAdminEligibleUsers(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, showAddUsers]);

  // Load eligible users when panel opens
  useEffect(() => {
    if (showAddUsers) {
      fetchAdminEligibleUsers(search);
    }
  }, [showAddUsers]);

  const handleToggleUser = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === adminEligibleUsers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(adminEligibleUsers.map((u) => u.id));
    }
  };

  const handleAssign = async () => {
    setAssignError('');
    setAssignSuccess('');
    if (selectedIds.length === 0) {
      setAssignError('Please select at least one user.');
      return;
    }
    try {
      const result = await adminBulkAssignUsers(selectedIds);
      const assignedCount = result.assigned?.length || 0;
      const skippedCount = result.skipped?.length || 0;
      setAssignSuccess(
        `Successfully added ${assignedCount} user(s) to your organization.${
          skippedCount > 0 ? ` ${skippedCount} skipped.` : ''
        }`
      );
      setSelectedIds([]);
      fetchAdminOrgUsers(); // refresh member list
    } catch (err) {
      setAssignError(err?.response?.data?.error || 'Failed to assign users.');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">My Organization</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Manage your organization's members and settings.
        </p>
      </div>

      {/* Org Info Card */}
      {myOrg && (
        <div className="bg-[var(--surface)] border border-[var(--outline)] rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--primary)] flex items-center justify-center text-white font-bold text-lg shrink-0">
              {myOrg.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{myOrg.name}</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                Slug: <span className="font-mono text-[var(--text-primary)]">{myOrg.slug}</span>
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {(myOrg.admin_ids?.length || 0)} admin(s) · {adminOrgUsers.length} member(s)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Members Section */}
      <div className="bg-[var(--surface)] border border-[var(--outline)] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--outline)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            Members ({adminOrgUsers.length})
          </h3>
          <button
            onClick={() => {
              setShowAddUsers((v) => !v);
              setSearch('');
              setSelectedIds([]);
              setAssignError('');
              setAssignSuccess('');
            }}
            className="text-sm font-medium px-4 py-2 rounded-xl bg-[var(--primary)] text-white hover:opacity-90 transition"
          >
            {showAddUsers ? 'Close' : '+ Add Users'}
          </button>
        </div>

        {/* Add Users Panel */}
        {showAddUsers && (
          <div className="px-5 py-4 border-b border-[var(--outline)] bg-[var(--bg)]">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Add Existing Users</h4>

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

            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full p-2.5 mb-3 rounded-xl border border-[var(--outline)] bg-[var(--surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />

            {/* Checkbox List */}
            <div className="border border-[var(--outline)] rounded-xl overflow-hidden mb-3">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--outline)] bg-[var(--surface)]">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  {adminEligibleUsers.length} user(s) found
                </span>
                {adminEligibleUsers.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs text-[var(--primary)] hover:underline"
                  >
                    {selectedIds.length === adminEligibleUsers.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
              {adminEligibleUsers.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)] text-center py-6 px-4">
                  {search ? 'No users match your search.' : 'No eligible users available.'}
                </p>
              ) : (
                <div className="max-h-52 overflow-y-auto divide-y divide-[var(--outline)]">
                  {adminEligibleUsers.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[var(--surface)] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(user.id)}
                        onChange={() => handleToggleUser(user.id)}
                        className="w-4 h-4 rounded border-[var(--outline)] text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user.name}</p>
                        <p className="text-xs text-[var(--text-secondary)] truncate">{user.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {selectedIds.length > 0 && (
              <p className="text-xs text-[var(--text-secondary)] mb-3">{selectedIds.length} user(s) selected</p>
            )}

            <button
              onClick={handleAssign}
              disabled={selectedIds.length === 0}
              className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add {selectedIds.length > 0 ? `(${selectedIds.length})` : ''} to Organization
            </button>
          </div>
        )}

        {/* Members List */}
        {adminOrgUsers.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-sm text-[var(--text-secondary)]">No members yet. Add users to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--outline)]">
            {adminOrgUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-sm font-semibold shrink-0">
                  {user.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user.name}</p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">{user.email}</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium shrink-0 capitalize">
                  {user.role}
                </span>
                {user.is_suspended && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium shrink-0">
                    Suspended
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
