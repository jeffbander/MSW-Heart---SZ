'use client';

import { useEffect, useRef } from 'react';

interface DateContextMenuProps {
  x: number;
  y: number;
  date: string;
  hasNote: boolean;
  onAddNote: () => void;
  onClose: () => void;
}

const colors = {
  primaryBlue: '#003D7A',
  noteBlue: '#3B82F6',
};

export default function DateContextMenu({
  x,
  y,
  hasNote,
  onAddNote,
  onClose,
}: DateContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to keep menu in viewport
  const adjustedX = Math.min(x, window.innerWidth - 180);
  const adjustedY = Math.min(y, window.innerHeight - 50);

  return (
    <div
      ref={menuRef}
      className="fixed bg-white rounded-lg shadow-lg border py-1 z-[60]"
      style={{
        left: adjustedX,
        top: adjustedY,
        minWidth: '160px',
      }}
    >
      <button
        className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2"
        onClick={() => {
          onAddNote();
          onClose();
        }}
      >
        <svg
          className="w-4 h-4"
          style={{ color: colors.noteBlue }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        <span style={{ color: colors.primaryBlue }}>
          {hasNote ? 'Edit Day Note' : 'Add Day Note'}
        </span>
      </button>
    </div>
  );
}
