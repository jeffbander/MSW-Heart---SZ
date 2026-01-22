'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import UndoHistoryModal from '../components/admin/UndoHistoryModal';
import BulkProviderModal from '../components/admin/BulkProviderModal';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  warningAmber: '#F59E0B',
};

interface Stats {
  providers: number;
  services: number;
  assignments: number;
  pendingPTO: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ providers: 0, services: 0, assignments: 0, pendingPTO: 0 });
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showUndoHistoryModal, setShowUndoHistoryModal] = useState(false);
  const [showBulkProviderModal, setShowBulkProviderModal] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const [providersRes, servicesRes, assignmentsRes, ptoRes] = await Promise.all([
        fetch('/api/providers'),
        fetch('/api/services?all=true'),
        fetch('/api/assignments'),
        fetch('/api/pto-requests?status=pending')
      ]);

      const providers = await providersRes.json();
      const services = await servicesRes.json();
      const assignments = await assignmentsRes.json();
      const pendingPTO = await ptoRes.json();

      setStats({
        providers: Array.isArray(providers) ? providers.length : 0,
        services: Array.isArray(services) ? services.length : 0,
        assignments: Array.isArray(assignments) ? assignments.length : 0,
        pendingPTO: Array.isArray(pendingPTO) ? pendingPTO.length : 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleActionComplete = () => {
    // Refresh stats after any action
    fetchStats();
  };

  const cards = [
    { label: 'Total Providers', value: stats.providers, href: '/admin/providers', color: colors.primaryBlue },
    { label: 'Total Services', value: stats.services, href: '/admin/services', color: colors.lightBlue },
    { label: 'Total Assignments', value: stats.assignments, href: '/', color: colors.teal },
    { label: 'Pending PTO Requests', value: stats.pendingPTO, href: '/admin/pto-requests', color: stats.pendingPTO > 0 ? '#F59E0B' : colors.teal },
  ];

  if (loading) {
    return <div className="text-center py-8">Loading dashboard...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ color: colors.primaryBlue }}>
        Dashboard
      </h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <div className="text-sm text-gray-500 mb-1">{card.label}</div>
            <div className="text-3xl font-bold" style={{ color: card.color }}>
              {card.value}
            </div>
          </Link>
        ))}
      </div>

      {/* Schedule Operations */}
      <h3 className="text-lg font-semibold mb-4" style={{ color: colors.primaryBlue }}>
        Schedule Operations
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => setShowUndoHistoryModal(true)}
          className="p-4 bg-white rounded-lg shadow text-center hover:shadow-md transition-shadow"
        >
          <div className="flex justify-center mb-2">
            <svg className="w-8 h-8" style={{ color: colors.lightBlue }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </div>
          <div className="font-medium" style={{ color: colors.primaryBlue }}>Recent Changes</div>
          <div className="text-sm text-gray-500">View and undo recent operations</div>
        </button>

        <button
          onClick={() => setShowBulkProviderModal(true)}
          className="p-4 bg-white rounded-lg shadow text-center hover:shadow-md transition-shadow"
        >
          <div className="flex justify-center mb-2">
            <svg className="w-8 h-8" style={{ color: colors.teal }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="font-medium" style={{ color: colors.primaryBlue }}>Bulk Provider Operations</div>
          <div className="text-sm text-gray-500">Add/remove provider patterns</div>
        </button>

        <Link
          href="/admin/templates"
          className="p-4 bg-white rounded-lg shadow text-center hover:shadow-md transition-shadow"
        >
          <div className="flex justify-center mb-2">
            <svg className="w-8 h-8" style={{ color: colors.warningAmber }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="font-medium" style={{ color: colors.primaryBlue }}>Manage Templates</div>
          <div className="text-sm text-gray-500">View and edit schedule templates</div>
        </Link>
      </div>

      {/* Quick Actions */}
      <h3 className="text-lg font-semibold mb-4" style={{ color: colors.primaryBlue }}>
        Quick Actions
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/admin/providers"
          className="p-4 bg-white rounded-lg shadow text-center hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-2">+</div>
          <div className="font-medium" style={{ color: colors.primaryBlue }}>Manage Providers</div>
        </Link>
        <Link
          href="/admin/services"
          className="p-4 bg-white rounded-lg shadow text-center hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-2">+</div>
          <div className="font-medium" style={{ color: colors.primaryBlue }}>Manage Services</div>
        </Link>
        <Link
          href="/admin/pto-requests"
          className="p-4 bg-white rounded-lg shadow text-center hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-2">+</div>
          <div className="font-medium" style={{ color: colors.primaryBlue }}>PTO Requests</div>
        </Link>
        <Link
          href="/admin/reports"
          className="p-4 bg-white rounded-lg shadow text-center hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-2">+</div>
          <div className="font-medium" style={{ color: colors.primaryBlue }}>View Reports</div>
        </Link>
        <Link
          href="/"
          className="p-4 bg-white rounded-lg shadow text-center hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-2">+</div>
          <div className="font-medium" style={{ color: colors.primaryBlue }}>Go to Calendar</div>
        </Link>
      </div>

      {/* Modals */}
      <UndoHistoryModal
        isOpen={showUndoHistoryModal}
        onClose={() => setShowUndoHistoryModal(false)}
        onActionComplete={handleActionComplete}
      />

      <BulkProviderModal
        isOpen={showBulkProviderModal}
        onClose={() => setShowBulkProviderModal(false)}
        onActionComplete={handleActionComplete}
      />
    </div>
  );
}
