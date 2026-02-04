'use client';

import { useEffect, useState, useMemo } from 'react';
import { Provider } from '@/lib/types';
import { useAdmin } from '@/app/contexts/AuthContext';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  ptoRed: '#DC2626',
  border: '#E5E7EB',
  success: '#059669',
  warning: '#F59E0B',
};

interface PTOBalance {
  annual_allowance: number;
  carryover_days: number;
  total_available: number;
  days_used: number;
  days_remaining: number;
  pending_days: number;
  allowance_source: string;
  warning: {
    level: 'none' | 'approaching' | 'exceeded';
    message: string | null;
  };
}

const AVAILABLE_CAPABILITIES = [
  'Inpatient', 'Rooms', 'Admin', 'Precepting', 'Offsites', 'PTO',
  'Stress Echo', 'Nuclear Stress', 'Vascular', 'Nuclear',
  'Fourth Floor Echo Lab', 'Echo TTE', 'Video Visits',
  'Provider Support', 'Virtual Support', 'E-consults',
  'Hospital at Home', 'CT', 'CMR'
];

export default function ProvidersAdminPage() {
  const { isAdminMode } = useAdmin();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterCapability, setFilterCapability] = useState('');
  const [sortField, setSortField] = useState<'initials' | 'name' | 'role' | 'rooms' | 'pto'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [formData, setFormData] = useState({
    name: '',
    initials: '',
    role: 'attending',
    default_room_count: 0,
    capabilities: [] as string[]
  });

  // PTO Balance management state
  const [ptoBalances, setPtoBalances] = useState<Record<string, PTOBalance>>({});
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [editingPTO, setEditingPTO] = useState<Provider | null>(null);
  const [ptoFormData, setPtoFormData] = useState({
    annual_allowance: '',
    carryover_days: '0',
    notes: ''
  });
  const [savingPTO, setSavingPTO] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, []);

  // Fetch PTO balances when providers change
  useEffect(() => {
    if (providers.length > 0) {
      fetchPTOBalances();
    }
  }, [providers]);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/providers');
      const data = await response.json();
      setProviders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPTOBalances = async () => {
    setLoadingBalances(true);
    const balances: Record<string, PTOBalance> = {};

    // Fetch balances for all providers in parallel
    await Promise.all(
      providers.map(async (provider) => {
        try {
          const response = await fetch(`/api/providers/${provider.id}/pto-balance`);
          if (response.ok) {
            const data = await response.json();
            balances[provider.id] = data;
          }
        } catch (error) {
          console.error(`Error fetching PTO balance for ${provider.initials}:`, error);
        }
      })
    );

    setPtoBalances(balances);
    setLoadingBalances(false);
  };

  const startEditPTO = (provider: Provider) => {
    const balance = ptoBalances[provider.id];
    setEditingPTO(provider);
    setPtoFormData({
      annual_allowance: balance?.allowance_source === 'provider_config' ? String(balance.annual_allowance) : '',
      carryover_days: String(balance?.carryover_days || 0),
      notes: ''
    });
  };

  const handleSavePTO = async () => {
    if (!editingPTO) return;

    setSavingPTO(true);
    try {
      const year = new Date().getFullYear();
      const response = await fetch(`/api/providers/${editingPTO.id}/pto-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          annual_allowance: ptoFormData.annual_allowance ? parseFloat(ptoFormData.annual_allowance) : null,
          carryover_days: parseFloat(ptoFormData.carryover_days) || 0,
          notes: ptoFormData.notes || null
        })
      });

      if (response.ok) {
        setEditingPTO(null);
        fetchPTOBalances();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save PTO configuration');
      }
    } catch (error) {
      console.error('Error saving PTO config:', error);
      alert('Failed to save PTO configuration');
    } finally {
      setSavingPTO(false);
    }
  };

  const getDefaultAllowance = (role: string): number => {
    const defaults: Record<string, number> = {
      'attending': 20,
      'Attending': 20,
      'fellow': 15,
      'Fellow': 15,
      'np': 15,
      'NP': 15,
      'pa': 15,
      'PA': 15
    };
    return defaults[role] || 20;
  };

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchProviders();
        setIsCreating(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error creating provider:', error);
    }
  };

  const handleUpdate = async () => {
    if (!editingProvider) return;

    try {
      const response = await fetch('/api/providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingProvider.id, ...formData })
      });

      if (response.ok) {
        await fetchProviders();
        setEditingProvider(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error updating provider:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this provider? This will also delete all their assignments.')) {
      return;
    }

    try {
      const response = await fetch(`/api/providers?id=${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchProviders();
      }
    } catch (error) {
      console.error('Error deleting provider:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      initials: '',
      role: 'attending',
      default_room_count: 0,
      capabilities: []
    });
  };

  const startEdit = (provider: Provider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      initials: provider.initials,
      role: provider.role,
      default_room_count: provider.default_room_count,
      capabilities: provider.capabilities
    });
  };

  const toggleCapability = (cap: string) => {
    setFormData(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(cap)
        ? prev.capabilities.filter(c => c !== cap)
        : [...prev.capabilities, cap]
    }));
  };

  const handleProviderSort = (field: 'initials' | 'name' | 'role' | 'rooms' | 'pto') => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filteredProviders = useMemo(() => {
    let result = providers.filter(p => {
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())
          && !p.initials.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterRole && p.role !== filterRole) return false;
      if (filterCapability && !p.capabilities.includes(filterCapability)) return false;
      return true;
    });
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'initials':
          cmp = a.initials.localeCompare(b.initials);
          break;
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'role':
          cmp = a.role.localeCompare(b.role);
          break;
        case 'rooms':
          cmp = a.default_room_count - b.default_room_count;
          break;
        case 'pto':
          cmp = (ptoBalances[a.id]?.days_remaining ?? 0) - (ptoBalances[b.id]?.days_remaining ?? 0);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [providers, searchQuery, filterRole, filterCapability, sortField, sortDir, ptoBalances]);

  if (loading) {
    return <div className="text-center py-8">Loading providers...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
          Manage Providers ({providers.length})
        </h2>
        <button
          onClick={() => { setIsCreating(true); resetForm(); }}
          disabled={!isAdminMode}
          className={`px-4 py-2 rounded text-white font-medium ${!isAdminMode ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{ backgroundColor: colors.teal }}
          title={!isAdminMode ? 'Admin Mode required' : ''}
        >
          + Add Provider
        </button>
      </div>

      {/* Create/Edit Form Modal */}
      {(isCreating || editingProvider) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
            <h3 className="text-xl font-bold mb-4" style={{ color: colors.primaryBlue }}>
              {editingProvider ? 'Edit Provider' : 'Add New Provider'}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                    style={{ borderColor: colors.border }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Initials</label>
                  <input
                    type="text"
                    value={formData.initials}
                    onChange={(e) => setFormData(prev => ({ ...prev, initials: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                    style={{ borderColor: colors.border }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                    style={{ borderColor: colors.border }}
                  >
                    <option value="attending">Attending</option>
                    <option value="fellow">Fellow</option>
                    <option value="pa">PA (Physician Assistant)</option>
                    <option value="np">NP (Nurse Practitioner)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Default Room Count</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.default_room_count}
                    onChange={(e) => setFormData(prev => ({ ...prev, default_room_count: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded"
                    style={{ borderColor: colors.border }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Capabilities</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_CAPABILITIES.map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => toggleCapability(cap)}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        formData.capabilities.includes(cap)
                          ? 'text-white'
                          : 'bg-white'
                      }`}
                      style={{
                        backgroundColor: formData.capabilities.includes(cap) ? colors.lightBlue : 'white',
                        borderColor: colors.lightBlue,
                        color: formData.capabilities.includes(cap) ? 'white' : colors.primaryBlue
                      }}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={editingProvider ? handleUpdate : handleCreate}
                  className="px-6 py-2 rounded text-white font-medium"
                  style={{ backgroundColor: colors.primaryBlue }}
                >
                  {editingProvider ? 'Save Changes' : 'Create Provider'}
                </button>
                <button
                  onClick={() => { setIsCreating(false); setEditingProvider(null); resetForm(); }}
                  className="px-6 py-2 rounded border font-medium"
                  style={{ borderColor: colors.border }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PTO Configuration Modal */}
      {editingPTO && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4" style={{ color: colors.primaryBlue }}>
              PTO Settings - {editingPTO.initials}
            </h3>

            <div className="mb-4 p-3 rounded-lg bg-gray-50">
              <div className="text-sm text-gray-600 mb-1">Role Default Allowance</div>
              <div className="text-lg font-medium" style={{ color: colors.primaryBlue }}>
                {getDefaultAllowance(editingPTO.role)} days/year
              </div>
              <div className="text-xs text-gray-400">
                Based on {editingPTO.role === 'attending' || editingPTO.role === 'Attending' ? 'Attending' :
                  editingPTO.role === 'fellow' || editingPTO.role === 'Fellow' ? 'Fellow' :
                  editingPTO.role.toUpperCase()} role
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Custom Annual Allowance (days)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={ptoFormData.annual_allowance}
                  onChange={(e) => setPtoFormData(prev => ({ ...prev, annual_allowance: e.target.value }))}
                  placeholder={`Leave empty to use role default (${getDefaultAllowance(editingPTO.role)})`}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                />
                <div className="text-xs text-gray-400 mt-1">
                  Leave empty to use role-based default
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Carryover Days
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={ptoFormData.carryover_days}
                  onChange={(e) => setPtoFormData(prev => ({ ...prev, carryover_days: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                />
                <div className="text-xs text-gray-400 mt-1">
                  Days carried over from previous year
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={ptoFormData.notes}
                  onChange={(e) => setPtoFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border rounded resize-none"
                  style={{ borderColor: colors.border }}
                  placeholder="e.g., Negotiated extra days, FMLA adjustment..."
                />
              </div>

              {ptoBalances[editingPTO.id] && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#EFF6FF' }}>
                  <div className="text-sm font-medium" style={{ color: colors.primaryBlue }}>
                    Current Year Summary
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                    <div>
                      <span className="text-gray-500">Days Used:</span>{' '}
                      <span className="font-medium">{ptoBalances[editingPTO.id].days_used}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Remaining:</span>{' '}
                      <span
                        className="font-medium"
                        style={{
                          color: ptoBalances[editingPTO.id].days_remaining < 0 ? colors.ptoRed : colors.success
                        }}
                      >
                        {ptoBalances[editingPTO.id].days_remaining}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-6">
              <button
                onClick={handleSavePTO}
                disabled={savingPTO}
                className="px-6 py-2 rounded text-white font-medium disabled:opacity-50"
                style={{ backgroundColor: colors.primaryBlue }}
              >
                {savingPTO ? 'Saving...' : 'Save Configuration'}
              </button>
              <button
                onClick={() => setEditingPTO(null)}
                className="px-6 py-2 rounded border font-medium"
                style={{ borderColor: colors.border }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by name/initials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
              style={{ borderColor: colors.border }}
            />
          </div>
          <div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 border rounded text-sm"
              style={{ borderColor: colors.border }}
            >
              <option value="">All Roles</option>
              <option value="attending">Attending</option>
              <option value="fellow">Fellow</option>
              <option value="pa">PA</option>
              <option value="np">NP</option>
            </select>
          </div>
          <div>
            <select
              value={filterCapability}
              onChange={(e) => setFilterCapability(e.target.value)}
              className="px-3 py-2 border rounded text-sm"
              style={{ borderColor: colors.border }}
            >
              <option value="">All Capabilities</option>
              {AVAILABLE_CAPABILITIES.map(cap => (
                <option key={cap} value={cap}>{cap}</option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-500">
            Showing {filteredProviders.length} of {providers.length}
          </div>
        </div>
      </div>

      {/* Providers Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: colors.primaryBlue }}>
              <th className="px-4 py-3 text-left text-white text-sm font-medium cursor-pointer select-none" onClick={() => handleProviderSort('initials')}>
                Initials {sortField === 'initials' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="px-4 py-3 text-left text-white text-sm font-medium cursor-pointer select-none" onClick={() => handleProviderSort('name')}>
                Name {sortField === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="px-4 py-3 text-left text-white text-sm font-medium cursor-pointer select-none" onClick={() => handleProviderSort('role')}>
                Role {sortField === 'role' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="px-4 py-3 text-left text-white text-sm font-medium cursor-pointer select-none" onClick={() => handleProviderSort('pto')}>
                PTO Balance {sortField === 'pto' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="px-4 py-3 text-left text-white text-sm font-medium cursor-pointer select-none" onClick={() => handleProviderSort('rooms')}>
                Rooms {sortField === 'rooms' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="px-4 py-3 text-left text-white text-sm font-medium">Capabilities</th>
              <th className="px-4 py-3 text-right text-white text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProviders.map((provider, idx) => (
              <tr
                key={provider.id}
                className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
                <td className="px-4 py-3 font-bold" style={{ color: colors.primaryBlue }}>
                  {provider.initials}
                </td>
                <td className="px-4 py-3">{provider.name}</td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-1 rounded text-xs font-medium text-white"
                    style={{
                      backgroundColor:
                        provider.role === 'fellow' ? colors.teal :
                        provider.role === 'pa' ? '#7C3AED' :
                        provider.role === 'np' ? '#059669' :
                        colors.lightBlue
                    }}
                  >
                    {provider.role === 'fellow' ? 'Fellow' :
                     provider.role === 'pa' ? 'PA' :
                     provider.role === 'np' ? 'NP' : 'MD'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {loadingBalances ? (
                    <span className="text-xs text-gray-400">Loading...</span>
                  ) : ptoBalances[provider.id] ? (
                    <button
                      onClick={() => startEditPTO(provider)}
                      disabled={!isAdminMode}
                      className={`text-left group ${!isAdminMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={!isAdminMode ? 'Admin Mode required' : ''}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="font-medium"
                          style={{
                            color: ptoBalances[provider.id].warning.level === 'exceeded' ? colors.ptoRed :
                              ptoBalances[provider.id].warning.level === 'approaching' ? colors.warning :
                              colors.success
                          }}
                        >
                          {ptoBalances[provider.id].days_remaining}
                        </span>
                        <span className="text-xs text-gray-500">
                          / {ptoBalances[provider.id].total_available}
                        </span>
                        <svg className="w-3 h-3 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </div>
                      {ptoBalances[provider.id].pending_days > 0 && (
                        <div className="text-xs text-gray-400">
                          ({ptoBalances[provider.id].pending_days} pending)
                        </div>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => startEditPTO(provider)}
                      disabled={!isAdminMode}
                      className={`text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 ${!isAdminMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={!isAdminMode ? 'Admin Mode required' : ''}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Configure
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">{provider.default_room_count}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1 max-w-md">
                    {provider.capabilities.length > 0 ? (
                      provider.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="px-2 py-0.5 rounded text-xs"
                          style={{ backgroundColor: '#E6F2FF', color: colors.primaryBlue }}
                        >
                          {cap}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400 italic">No capabilities</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => startEdit(provider)}
                    disabled={!isAdminMode}
                    className={`px-3 py-1 rounded text-sm mr-2 ${!isAdminMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{ backgroundColor: colors.lightBlue, color: 'white' }}
                    title={!isAdminMode ? 'Admin Mode required' : ''}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(provider.id)}
                    disabled={!isAdminMode}
                    className={`px-3 py-1 rounded text-sm ${!isAdminMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{ backgroundColor: colors.ptoRed, color: 'white' }}
                    title={!isAdminMode ? 'Admin Mode required' : ''}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
