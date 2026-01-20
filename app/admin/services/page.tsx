'use client';

import { useEffect, useState } from 'react';
import { Service, Provider } from '@/lib/types';
import { useAdmin } from '@/app/contexts/AdminContext';

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

export default function ServicesAdminPage() {
  const { isAdminMode } = useAdmin();
  const [services, setServices] = useState<Service[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [viewingEligible, setViewingEligible] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    time_block: 'AM' as 'AM' | 'PM' | 'BOTH',
    requires_rooms: false,
    required_capability: '',
    show_on_main_calendar: true
  });

  useEffect(() => {
    fetchServices();
    fetchProviders();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/services?all=true');
      const data = await response.json();
      setServices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/providers');
      const data = await response.json();
      setProviders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  };

  const getEligibleProviders = (service: Service) => {
    if (!service.required_capability) {
      return providers;
    }
    return providers.filter(p => p.capabilities.includes(service.required_capability!));
  };

  const getEligibilityColor = (count: number) => {
    if (count === 0) return colors.ptoRed;
    if (count < 5) return '#D97706'; // Yellow/Orange
    return '#059669'; // Green
  };

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          required_capability: formData.required_capability || null
        })
      });

      if (response.ok) {
        await fetchServices();
        setIsCreating(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error creating service:', error);
    }
  };

  const handleUpdate = async () => {
    if (!editingService) return;

    try {
      const response = await fetch('/api/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingService.id,
          ...formData,
          required_capability: formData.required_capability || null
        })
      });

      if (response.ok) {
        await fetchServices();
        setEditingService(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error updating service:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service? This will also delete all assignments for this service.')) {
      return;
    }

    try {
      const response = await fetch(`/api/services?id=${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchServices();
      }
    } catch (error) {
      console.error('Error deleting service:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      time_block: 'AM',
      requires_rooms: false,
      required_capability: '',
      show_on_main_calendar: true
    });
  };

  const startEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      time_block: service.time_block,
      requires_rooms: service.requires_rooms,
      required_capability: service.required_capability || '',
      show_on_main_calendar: service.show_on_main_calendar
    });
  };

  if (loading) {
    return <div className="text-center py-8">Loading services...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
          Manage Services ({services.length})
        </h2>
        <button
          onClick={() => { setIsCreating(true); resetForm(); }}
          disabled={!isAdminMode}
          className={`px-4 py-2 rounded text-white font-medium ${!isAdminMode ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{ backgroundColor: colors.teal }}
          title={!isAdminMode ? 'Admin Mode required' : ''}
        >
          + Add Service
        </button>
      </div>

      {/* Create/Edit Form Modal */}
      {(isCreating || editingService) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold mb-4" style={{ color: colors.primaryBlue }}>
              {editingService ? 'Edit Service' : 'Add New Service'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Service Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Time Block</label>
                <select
                  value={formData.time_block}
                  onChange={(e) => setFormData(prev => ({ ...prev, time_block: e.target.value as 'AM' | 'PM' | 'BOTH' }))}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                  <option value="BOTH">All Day (BOTH)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Required Capability</label>
                <select
                  value={formData.required_capability}
                  onChange={(e) => setFormData(prev => ({ ...prev, required_capability: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                >
                  <option value="">None (any provider)</option>
                  {AVAILABLE_CAPABILITIES.map(cap => (
                    <option key={cap} value={cap}>{cap}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.requires_rooms}
                    onChange={(e) => setFormData(prev => ({ ...prev, requires_rooms: e.target.checked }))}
                  />
                  <span className="text-sm">Requires Rooms</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.show_on_main_calendar}
                    onChange={(e) => setFormData(prev => ({ ...prev, show_on_main_calendar: e.target.checked }))}
                  />
                  <span className="text-sm">Show on Main Calendar</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={editingService ? handleUpdate : handleCreate}
                  className="px-6 py-2 rounded text-white font-medium"
                  style={{ backgroundColor: colors.primaryBlue }}
                >
                  {editingService ? 'Save Changes' : 'Create Service'}
                </button>
                <button
                  onClick={() => { setIsCreating(false); setEditingService(null); resetForm(); }}
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

      {/* View Eligible Providers Modal */}
      {viewingEligible && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-auto">
            <h3 className="text-xl font-bold mb-2" style={{ color: colors.primaryBlue }}>
              Eligible Providers for {viewingEligible.name}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {viewingEligible.required_capability
                ? `Requires capability: ${viewingEligible.required_capability}`
                : 'No capability required - all providers eligible'}
            </p>

            <div className="space-y-2 mb-4">
              {getEligibleProviders(viewingEligible).map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between p-2 rounded"
                  style={{ backgroundColor: '#F3F4F6' }}
                >
                  <div>
                    <span className="font-bold" style={{ color: colors.primaryBlue }}>
                      {provider.initials}
                    </span>
                    <span className="text-gray-600 ml-2">{provider.name}</span>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded text-xs text-white"
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
                </div>
              ))}
              {getEligibleProviders(viewingEligible).length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  No providers have this capability
                </p>
              )}
            </div>

            <button
              onClick={() => setViewingEligible(null)}
              className="w-full px-4 py-2 rounded text-white font-medium"
              style={{ backgroundColor: colors.primaryBlue }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Services Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: colors.primaryBlue }}>
              <th className="px-4 py-3 text-left text-white text-sm font-medium">Name</th>
              <th className="px-4 py-3 text-left text-white text-sm font-medium">Time Block</th>
              <th className="px-4 py-3 text-left text-white text-sm font-medium">Required Capability</th>
              <th className="px-4 py-3 text-center text-white text-sm font-medium">Eligible</th>
              <th className="px-4 py-3 text-center text-white text-sm font-medium">Rooms</th>
              <th className="px-4 py-3 text-center text-white text-sm font-medium">Calendar</th>
              <th className="px-4 py-3 text-right text-white text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service, idx) => {
              const eligibleProviders = getEligibleProviders(service);
              const eligibleCount = eligibleProviders.length;

              return (
                <tr
                  key={service.id}
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: colors.primaryBlue }}>
                    {service.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: service.time_block === 'BOTH' ? colors.teal : colors.lightBlue,
                        color: 'white'
                      }}
                    >
                      {service.time_block}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {service.required_capability ? (
                      <span
                        className="px-2 py-1 rounded text-xs"
                        style={{ backgroundColor: '#E6F2FF', color: colors.primaryBlue }}
                      >
                        {service.required_capability}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">None required</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setViewingEligible(service)}
                      className="px-2 py-1 rounded text-xs font-medium text-white hover:opacity-80"
                      style={{ backgroundColor: getEligibilityColor(eligibleCount) }}
                      title="Click to view eligible providers"
                    >
                      {eligibleCount} provider{eligibleCount !== 1 ? 's' : ''}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {service.requires_rooms ? 'Yes' : '-'}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {service.show_on_main_calendar ? 'Yes' : 'No'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => startEdit(service)}
                      disabled={!isAdminMode}
                      className={`px-3 py-1 rounded text-sm mr-2 ${!isAdminMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{ backgroundColor: colors.lightBlue, color: 'white' }}
                      title={!isAdminMode ? 'Admin Mode required' : ''}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(service.id)}
                      disabled={!isAdminMode}
                      className={`px-3 py-1 rounded text-sm ${!isAdminMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{ backgroundColor: colors.ptoRed, color: 'white' }}
                      title={!isAdminMode ? 'Admin Mode required' : ''}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
