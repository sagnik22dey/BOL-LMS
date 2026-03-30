import React, { useState, useEffect } from 'react';
import { useCourseBundleStore } from '../../store/courseBundleStore';
import { useUserStore } from '../../store/userStore';
import { useCourseStore } from '../../store/courseStore';

const inputClass = "w-full px-3 py-2 border border-[var(--outline)] rounded-xl bg-[var(--surface-low)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all";

const Modal = ({ open, onClose, children, title }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--surface-lowest)] rounded-2xl shadow-[var(--shadow-xl)] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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

const CourseBundleDetailsModal = ({ open, onClose, bundle }) => {
  const { users } = useUserStore();
  const { courses } = useCourseStore();
  const { addUsersToCourseBundle, removeUserFromCourseBundle, assignCoursesToCourseBundle, removeCourseFromCourseBundle, loading } = useCourseBundleStore();

  const [activeTab, setActiveTab] = useState('courses');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);

  if (!open || !bundle) return null;

  // Derived state
  const bundleUserIds = bundle.user_ids || [];
  const bundleCourseIds = bundle.course_ids || [];

  const currentMembers = users.filter(u => bundleUserIds.includes(u.id));
  const availableUsers = users.filter(u => u.role === 'user' && !bundleUserIds.includes(u.id));

  const currentCourses = courses.filter(c => bundleCourseIds.includes(c.id));
  const availableCourses = courses.filter(c => !bundleCourseIds.includes(c.id));

  const handleAddUsers = async () => {
    if (selectedUsers.length === 0) return;
    await addUsersToCourseBundle(bundle.id, selectedUsers);
    setSelectedUsers([]);
  };

  const handleAddCourses = async () => {
    if (selectedCourses.length === 0) return;
    await assignCoursesToCourseBundle(bundle.id, selectedCourses);
    setSelectedCourses([]);
  };

  return (
    <Modal open={open} onClose={onClose} title={`Course Bundle: ${bundle.name}`}>
      <div className="flex border-b border-[var(--outline)] mb-4 sticky top-[64px] bg-[var(--surface-lowest)] z-10">
        <button
          onClick={() => setActiveTab('courses')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'courses' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--text-secondary)]'}`}
        >
          Courses ({bundleCourseIds.length})
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'members' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--text-secondary)]'}`}
        >
          Assigned Users ({bundleUserIds.length})
        </button>
      </div>

      {activeTab === 'courses' && (
        <div className="flex flex-col gap-6">
          <div>
            <h4 className="font-bold text-sm text-[var(--text-primary)] mb-2">Build Bundle (Add Courses)</h4>
            <div className="flex gap-2 items-center">
              <select 
                multiple 
                className={`${inputClass} h-32`}
                value={selectedCourses}
                onChange={(e) => setSelectedCourses(Array.from(e.target.selectedOptions, option => option.value))}
              >
                {availableCourses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <button 
                onClick={handleAddCourses}
                disabled={loading || selectedCourses.length === 0}
                className="mt-2 px-4 py-2 rounded-xl text-sm font-bold bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50"
              >
                Add Selected Courses
            </button>
          </div>

          <div>
            <h4 className="font-bold text-sm text-[var(--text-primary)] mb-2">Courses in Bundle</h4>
            {currentCourses.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">No courses added to this bundle yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--outline)] border border-[var(--outline)] rounded-xl overflow-hidden">
                {currentCourses.map(c => (
                  <li key={c.id} className="flex justify-between items-center px-4 py-2 hover:bg-[var(--surface-low)] transition-colors">
                    <span className="text-sm text-[var(--text-primary)]">{c.title}</span>
                    <button 
                      onClick={() => removeCourseFromCourseBundle(bundle.id, c.id)}
                      disabled={loading}
                      className="text-xs text-[#ba1a1a] hover:bg-[#fdecea] px-2 py-1 rounded font-semibold transition-colors disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="flex flex-col gap-6">
          <div>
            <h4 className="font-bold text-sm text-[var(--text-primary)] mb-2">Assign Bundle to Users</h4>
            <div className="flex gap-2 items-center">
              <select 
                multiple 
                className={`${inputClass} h-32`}
                value={selectedUsers}
                onChange={(e) => setSelectedUsers(Array.from(e.target.selectedOptions, option => option.value))}
              >
                {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
            </div>
            <button 
                onClick={handleAddUsers}
                disabled={loading || selectedUsers.length === 0}
                className="mt-2 px-4 py-2 rounded-xl text-sm font-bold bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50"
              >
                Assign Selected Users
            </button>
          </div>

          <div>
            <h4 className="font-bold text-sm text-[var(--text-primary)] mb-2">Currently Assigned</h4>
            {currentMembers.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">No users are assigned this bundle.</p>
            ) : (
              <ul className="divide-y divide-[var(--outline)] border border-[var(--outline)] rounded-xl overflow-hidden">
                {currentMembers.map(u => (
                  <li key={u.id} className="flex justify-between items-center px-4 py-2 hover:bg-[var(--surface-low)] transition-colors">
                    <span className="text-sm text-[var(--text-primary)]">{u.name}</span>
                    <button 
                      onClick={() => removeUserFromCourseBundle(bundle.id, u.id)}
                      disabled={loading}
                      className="text-xs text-[#ba1a1a] hover:bg-[#fdecea] px-2 py-1 rounded font-semibold transition-colors disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

const CourseBundles = () => {
  const { courseBundles, fetchCourseBundles, createCourseBundle, updateCourseBundle, deleteCourseBundle, loading, error } = useCourseBundleStore();
  const { fetchUsers } = useUserStore();
  const { fetchCourses } = useCourseStore();

  const [openCreate, setOpenCreate] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', price: 0, currency: 'INR', validity_days: '' });
  const [formError, setFormError] = useState('');
  
  const [selectedBundle, setSelectedBundle] = useState(null);

  useEffect(() => {
    fetchCourseBundles();
    fetchUsers('admin'); 
    fetchCourses(); 
  }, [fetchCourseBundles, fetchUsers, fetchCourses]);

  const handleEditBundleClick = (e, bundle) => {
    e.stopPropagation(); 
    const newName = window.prompt("Enter new bundle name:", bundle.name);
    if (newName && newName !== bundle.name) {
      updateCourseBundle(bundle.id, { name: newName, description: bundle.description });
    }
  };

  const handleDeleteBundleClick = (e, id) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this course bundle?")) {
      deleteCourseBundle(id);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.name) { setFormError('Name is required'); return; }
    const payload = {
      ...formData,
      price: parseInt(formData.price, 10) || 0,
      validity_days: formData.validity_days ? parseInt(formData.validity_days, 10) : null
    };
    const success = await createCourseBundle(payload);
    if (success) {
      setOpenCreate(false);
      setFormData({ name: '', description: '', price: 0, currency: 'INR', validity_days: '' });
    } else {
      setFormError(useCourseBundleStore.getState().error || 'Failed to create course bundle');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-extrabold font-headline text-[var(--text-primary)]" style={{ letterSpacing: '-1px' }}>Course Bundles</h2>
          <p className="text-[var(--text-secondary)] text-sm mt-0.5">Bundle multiple courses and assign them to users</p>
        </div>
        <button
          onClick={() => setOpenCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-bold hover:bg-[var(--primary-dark)] transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Create Bundle
        </button>
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-[#fdecea] border border-[#f5c6c6] text-[#ba1a1a] text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courseBundles.map((bundle) => (
          <div 
            key={bundle.id} 
            className="premium-card p-5 cursor-pointer hover:border-[var(--primary)] transition-colors group"
            onClick={() => setSelectedBundle(bundle)}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex gap-3 items-center">
                <div className="p-2 rounded-xl bg-[#e8f0fe] text-[#1565c0]">
                  <span className="material-symbols-outlined text-xl">account_tree</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-[var(--text-primary)] leading-tight">{bundle.name}</h3>
                  <p className="text-xs text-[var(--text-secondary)]">{bundle.description || 'No description'}</p>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => handleEditBundleClick(e, bundle)} className="text-[var(--text-secondary)] hover:text-[var(--primary)] p-1">
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
                <button onClick={(e) => handleDeleteBundleClick(e, bundle.id)} className="text-[var(--text-secondary)] hover:text-[#ba1a1a] p-1">
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>
            
            <div className="flex justify-between mt-4 p-3 bg-[var(--surface-low)] rounded-xl">
              <div className="text-center">
                <p className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider mb-0.5">Courses</p>
                <p className="text-base font-bold text-[var(--text-primary)]">{bundle.course_ids?.length || 0}</p>
              </div>
              <div className="w-px bg-[var(--outline)] mx-2"></div>
              <div className="text-center">
                <p className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider mb-0.5">Price</p>
                <p className="text-base font-bold text-[var(--text-primary)]">{bundle.price > 0 ? `${bundle.currency} ${bundle.price}` : 'Free'}</p>
              </div>
              <div className="w-px bg-[var(--outline)] mx-2"></div>
              <div className="text-center">
                <p className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider mb-0.5">Assigned To</p>
                <p className="text-base font-bold text-[var(--text-primary)]">{bundle.user_ids?.length || 0}</p>
              </div>
            </div>
          </div>
        ))}
        {courseBundles.length === 0 && !loading && (
          <div className="col-span-full text-center py-16 text-[var(--text-secondary)]">
            <span className="material-symbols-outlined text-5xl opacity-20 block mb-3">account_tree</span>
            <p className="font-semibold text-base">No course bundles found</p>
            <p className="text-sm mt-1">Create a bundle to group courses and assign them.</p>
          </div>
        )}
      </div>

      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Create New Course Bundle">
        {formError && <div className="mb-4 px-4 py-3 rounded-xl bg-[#fdecea] border border-[#f5c6c6] text-[#ba1a1a] text-sm">{formError}</div>}
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-[var(--text-primary)]">Bundle Name</label>
            <input required name="name" className={inputClass} placeholder="e.g. Developer Essentials" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-[var(--text-primary)]">Description (optional)</label>
            <input name="description" className={inputClass} placeholder="A set of core courses" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <label className="text-sm font-semibold text-[var(--text-primary)]">Price</label>
              <input type="number" min="0" className={inputClass} value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <label className="text-sm font-semibold text-[var(--text-primary)]">Validity (Days)</label>
              <input type="number" min="1" className={inputClass} placeholder="Lifetime" value={formData.validity_days} onChange={(e) => setFormData({...formData, validity_days: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setOpenCreate(false)} disabled={loading} className="px-4 py-2 rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-high)] transition-colors disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-xl text-sm font-bold bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-60">
              Create Bundle
            </button>
          </div>
        </form>
      </Modal>

      <CourseBundleDetailsModal open={!!selectedBundle} onClose={() => setSelectedBundle(null)} bundle={courseBundles.find(g => g.id === selectedBundle?.id)} />
    </div>
  );
};

export default CourseBundles;
