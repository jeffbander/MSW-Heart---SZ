'use client';

import { useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  error: '#DC2626',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
};

interface LoginModalProps {
  onClose?: () => void;
}

export default function LoginModal({ onClose }: LoginModalProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setLoading(true);
    setError('');

    const result = await login(username.trim(), password);

    if (!result.success) {
      setError(result.error || 'Login failed');
    } else if (onClose) {
      onClose();
    }
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 bg-gradient-to-br from-blue-900/90 via-blue-800/90 to-blue-900/90 flex items-center justify-center z-50"
      onClick={onClose ? () => onClose() : undefined}
    >
      <div
        className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-sm mx-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
            MSW Cardiology
          </h1>
          <p className="text-sm text-gray-500 mt-1">Scheduler Login</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ borderColor: error ? colors.error : colors.border }}
              placeholder="Enter your username"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ borderColor: error ? colors.error : colors.border }}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-sm text-center" style={{ color: colors.error }}>
              {error}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full py-2.5 rounded-lg font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: colors.primaryBlue }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
