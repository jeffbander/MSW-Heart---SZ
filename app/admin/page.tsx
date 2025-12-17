'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
};

interface Stats {
  providers: number;
  services: number;
  assignments: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ providers: 0, services: 0, assignments: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [providersRes, servicesRes, assignmentsRes] = await Promise.all([
          fetch('/api/providers'),
          fetch('/api/services?all=true'),
          fetch('/api/assignments')
        ]);

        const providers = await providersRes.json();
        const services = await servicesRes.json();
        const assignments = await assignmentsRes.json();

        setStats({
          providers: Array.isArray(providers) ? providers.length : 0,
          services: Array.isArray(services) ? services.length : 0,
          assignments: Array.isArray(assignments) ? assignments.length : 0
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const cards = [
    { label: 'Total Providers', value: stats.providers, href: '/admin/providers', color: colors.primaryBlue },
    { label: 'Total Services', value: stats.services, href: '/admin/services', color: colors.lightBlue },
    { label: 'Total Assignments', value: stats.assignments, href: '/', color: colors.teal },
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
    </div>
  );
}
