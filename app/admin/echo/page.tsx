'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { EchoTech, EchoRoom } from '@/lib/types';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
  warningRed: '#DC2626',
};

export default function EchoAdminPage() {
  const [activeTab, setActiveTab] = useState<'techs' | 'rooms'>('techs');
  const [echoTechs, setEchoTechs] = useState<EchoTech[]>([]);
  const [echoRooms, setEchoRooms] = useState<EchoRoom[]>([]);
  const [loading, setLoading] = useState(true);

  // Tech form state
  const [showTechForm, setShowTechForm] = useState(false);
  const [editingTech, setEditingTech] = useState<EchoTech | null>(null);
  const [techForm, setTechForm] = useState({ name: '', initials: '', capacity_per_half_day: 5 });

  // Room form state
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState<EchoRoom | null>(null);
  const [roomForm, setRoomForm] = useState({
    category: 'CVI' as 'CVI' | 'Fourth Floor Lab',
    name: '',
    short_name: '',
    capacity_type: '' as string,
    display_order: 0
  });

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [techsRes, roomsRes] = await Promise.all([
        fetch('/api/echo-techs'),
        fetch('/api/echo-rooms')
      ]);
      if (techsRes.ok) setEchoTechs(await techsRes.json());
      if (roomsRes.ok) setEchoRooms(await roomsRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Tech CRUD
  const handleSaveTech = async () => {
    const url = '/api/echo-techs';
    const method = editingTech ? 'PUT' : 'POST';
    const body = editingTech
      ? { id: editingTech.id, ...techForm }
      : techForm;

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      await fetchData();
      setShowTechForm(false);
      setEditingTech(null);
      setTechForm({ name: '', initials: '', capacity_per_half_day: 5 });
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to save tech');
    }
  };

  const handleEditTech = (tech: EchoTech) => {
    setEditingTech(tech);
    setTechForm({
      name: tech.name,
      initials: tech.initials,
      capacity_per_half_day: tech.capacity_per_half_day
    });
    setShowTechForm(true);
  };

  const handleDeleteTech = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tech?')) return;
    const response = await fetch(`/api/echo-techs?id=${id}`, { method: 'DELETE' });
    if (response.ok) {
      await fetchData();
    } else {
      alert('Failed to delete tech');
    }
  };

  // Room CRUD
  const handleSaveRoom = async () => {
    const url = '/api/echo-rooms';
    const method = editingRoom ? 'PUT' : 'POST';
    const body = editingRoom
      ? { id: editingRoom.id, ...roomForm, capacity_type: roomForm.capacity_type || null }
      : { ...roomForm, capacity_type: roomForm.capacity_type || null };

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      await fetchData();
      setShowRoomForm(false);
      setEditingRoom(null);
      setRoomForm({ category: 'CVI', name: '', short_name: '', capacity_type: '', display_order: 0 });
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to save room');
    }
  };

  const handleEditRoom = (room: EchoRoom) => {
    setEditingRoom(room);
    setRoomForm({
      category: room.category as 'CVI' | 'Fourth Floor Lab',
      name: room.name,
      short_name: room.short_name || '',
      capacity_type: room.capacity_type || '',
      display_order: room.display_order
    });
    setShowRoomForm(true);
  };

  const handleDeleteRoom = async (id: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return;
    const response = await fetch(`/api/echo-rooms?id=${id}`, { method: 'DELETE' });
    if (response.ok) {
      await fetchData();
    } else {
      alert('Failed to delete room');
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: colors.lightGray }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/echo"
            className="text-sm hover:underline mb-2 inline-block"
            style={{ color: colors.primaryBlue }}
          >
            ← Back to Echo Schedule
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
            Echo Lab Admin
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('techs')}
            className={`px-4 py-2 rounded-t font-medium ${
              activeTab === 'techs' ? 'bg-white' : 'bg-gray-200'
            }`}
            style={{ color: colors.primaryBlue }}
          >
            Echo Techs ({echoTechs.length})
          </button>
          <button
            onClick={() => setActiveTab('rooms')}
            className={`px-4 py-2 rounded-t font-medium ${
              activeTab === 'rooms' ? 'bg-white' : 'bg-gray-200'
            }`}
            style={{ color: colors.primaryBlue }}
          >
            Echo Rooms ({echoRooms.length})
          </button>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : activeTab === 'techs' ? (
            /* Techs Tab */
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Echo Techs</h2>
                <button
                  onClick={() => {
                    setEditingTech(null);
                    setTechForm({ name: '', initials: '', capacity_per_half_day: 5 });
                    setShowTechForm(true);
                  }}
                  className="px-4 py-2 rounded text-white font-medium"
                  style={{ backgroundColor: colors.teal }}
                >
                  Add Tech
                </button>
              </div>

              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Initials</th>
                    <th className="text-left py-2">Capacity/Half Day</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-right py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {echoTechs.map(tech => (
                    <tr key={tech.id} className="border-b hover:bg-gray-50">
                      <td className="py-2">{tech.name}</td>
                      <td className="py-2">{tech.initials}</td>
                      <td className="py-2">{tech.capacity_per_half_day}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          tech.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {tech.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleEditTech(tech)}
                          className="text-blue-600 hover:underline mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTech(tech.id)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Rooms Tab */
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Echo Rooms</h2>
                <button
                  onClick={() => {
                    setEditingRoom(null);
                    setRoomForm({ category: 'CVI', name: '', short_name: '', capacity_type: '', display_order: 0 });
                    setShowRoomForm(true);
                  }}
                  className="px-4 py-2 rounded text-white font-medium"
                  style={{ backgroundColor: colors.teal }}
                >
                  Add Room
                </button>
              </div>

              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Category</th>
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Short Name</th>
                    <th className="text-left py-2">Capacity Type</th>
                    <th className="text-right py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {echoRooms.map(room => (
                    <tr key={room.id} className="border-b hover:bg-gray-50">
                      <td className="py-2">{room.category}</td>
                      <td className="py-2">{room.name}</td>
                      <td className="py-2">{room.short_name || '-'}</td>
                      <td className="py-2">{room.capacity_type || '-'}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleEditRoom(room)}
                          className="text-blue-600 hover:underline mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteRoom(room.id)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Tech Form Modal */}
      {showTechForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4" style={{ color: colors.primaryBlue }}>
              {editingTech ? 'Edit Tech' : 'Add Tech'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={techForm.name}
                  onChange={(e) => setTechForm({ ...techForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Initials</label>
                <input
                  type="text"
                  value={techForm.initials}
                  onChange={(e) => setTechForm({ ...techForm, initials: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Capacity per Half Day</label>
                <input
                  type="number"
                  value={techForm.capacity_per_half_day}
                  onChange={(e) => setTechForm({ ...techForm, capacity_per_half_day: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowTechForm(false)}
                className="px-4 py-2 rounded border font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTech}
                className="px-4 py-2 rounded text-white font-medium"
                style={{ backgroundColor: colors.teal }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room Form Modal */}
      {showRoomForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4" style={{ color: colors.primaryBlue }}>
              {editingRoom ? 'Edit Room' : 'Add Room'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={roomForm.category}
                  onChange={(e) => setRoomForm({ ...roomForm, category: e.target.value as 'CVI' | 'Fourth Floor Lab' })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="CVI">CVI</option>
                  <option value="Fourth Floor Lab">Fourth Floor Lab</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={roomForm.name}
                  onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Short Name (optional)</label>
                <input
                  type="text"
                  value={roomForm.short_name}
                  onChange={(e) => setRoomForm({ ...roomForm, short_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Capacity Type</label>
                <select
                  value={roomForm.capacity_type}
                  onChange={(e) => setRoomForm({ ...roomForm, capacity_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">None</option>
                  <option value="echo">Echo</option>
                  <option value="stress_echo">Stress Echo</option>
                  <option value="vascular">Vascular</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Display Order</label>
                <input
                  type="number"
                  value={roomForm.display_order}
                  onChange={(e) => setRoomForm({ ...roomForm, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowRoomForm(false)}
                className="px-4 py-2 rounded border font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRoom}
                className="px-4 py-2 rounded text-white font-medium"
                style={{ backgroundColor: colors.teal }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
