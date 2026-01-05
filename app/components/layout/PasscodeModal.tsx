'use client';

import { useState } from 'react';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  error: '#DC2626',
  lightGray: '#F5F5F5',
  border: '#E5E7EB',
};

interface PasscodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticate: (passcode: string) => boolean;
}

export default function PasscodeModal({ isOpen, onClose, onAuthenticate }: PasscodeModalProps) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  if (!isOpen) return null;

  const handleKeyPress = (key: string) => {
    if (key === 'clear') {
      setPasscode('');
      setError(false);
      return;
    }
    if (key === 'backspace') {
      setPasscode((prev) => prev.slice(0, -1));
      setError(false);
      return;
    }
    if (passcode.length < 6) {
      setPasscode((prev) => prev + key);
      setError(false);
    }
  };

  const handleSubmit = () => {
    const success = onAuthenticate(passcode);
    if (success) {
      setPasscode('');
      setError(false);
      onClose();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPasscode('');
    }
  };

  const handleClose = () => {
    setPasscode('');
    setError(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className={`bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 ${shake ? 'animate-shake' : ''}`}
        style={{ animation: shake ? 'shake 0.5s ease-in-out' : 'none' }}
      >
        <style jsx>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
          }
        `}</style>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold" style={{ color: colors.primaryBlue }}>
            Admin Access
          </h2>
          <p className="text-sm text-gray-500 mt-1">Enter passcode to continue</p>
        </div>

        {/* Passcode Display */}
        <div className="flex justify-center gap-2 mb-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="w-10 h-12 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-colors"
              style={{
                borderColor: error ? colors.error : passcode.length > i ? colors.primaryBlue : colors.border,
                backgroundColor: passcode.length > i ? colors.lightGray : 'white',
                color: colors.primaryBlue,
              }}
            >
              {passcode.length > i ? '•' : ''}
            </div>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-center text-sm mb-4" style={{ color: colors.error }}>
            Incorrect passcode. Please try again.
          </p>
        )}

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'].map((key) => (
            <button
              key={key}
              onClick={() => handleKeyPress(key)}
              className="h-14 rounded-lg text-xl font-medium transition-colors hover:bg-gray-100 active:bg-gray-200"
              style={{
                backgroundColor: key === 'clear' || key === 'backspace' ? colors.lightGray : 'white',
                color: colors.primaryBlue,
                border: `1px solid ${colors.border}`,
              }}
            >
              {key === 'clear' ? 'C' : key === 'backspace' ? '←' : key}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-3 rounded-lg font-medium border transition-colors hover:bg-gray-50"
            style={{ borderColor: colors.border }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={passcode.length === 0}
            className="flex-1 py-3 rounded-lg font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: colors.primaryBlue }}
          >
            Unlock
          </button>
        </div>
      </div>
    </div>
  );
}
