'use client';

import { useEffect, useState } from 'react';
import { Provider } from '@/lib/types';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  ptoRed: '#DC2626',
  border: '#E5E7EB',
};

const AVAILABLE_CAPABILITIES = [
  'Inpatient', 'Rooms', 'Admin', 'Precepting', 'Offsites', 'PTO',
  'Stress Echo', 'Nuclear Stress', 'Vascular', 'Nuclear',
  'Fourth Floor Echo Lab', 'Echo TTE', 'Video Visits',
  'Provider Support', 'Virtual Support', 'E-consults',
  'Hospital at Home', 'CT', 'CMR'
];

export default function ProvidersAdminPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    initials: '',
    role: 'attending',
    default_room_count: 0,
    capabilities: [] as string[]
  });

  useEffect(() => {
    fetchProviders();
  }, []);

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
          className="px-4 py-2 rounded text-white font-medium"
          style={{ backgroundColor: colors.teal }}
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

      {/* Providers Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: colors.primaryBlue }}>
              <th className="px-4 py-3 text-left text-white text-sm font-medium">Initials</th>
              <th className="px-4 py-3 text-left text-white text-sm font-medium">Name</th>
              <th className="px-4 py-3 text-left text-white text-sm font-medium">Role</th>
              <th className="px-4 py-3 text-left text-white text-sm font-medium">Rooms</th>
              <th className="px-4 py-3 text-left text-white text-sm font-medium">Capabilities</th>
              <th className="px-4 py-3 text-right text-white text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((provider, idx) => (
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
                    className="px-3 py-1 rounded text-sm mr-2"
                    style={{ backgroundColor: colors.lightBlue, color: 'white' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(provider.id)}
                    className="px-3 py-1 rounded text-sm"
                    style={{ backgroundColor: colors.ptoRed, color: 'white' }}
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
