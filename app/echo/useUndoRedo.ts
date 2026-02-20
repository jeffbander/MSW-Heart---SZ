'use client';

import { useRef, useState, useCallback } from 'react';

export type UndoableAction =
  | {
      type: 'create_assignment'
      assignmentId: string
      techId: string
      techName: string
      roomId: string
      date: string
      timeBlock: 'AM' | 'PM'
      notes: string | null
    }
  | {
      type: 'delete_assignment'
      assignmentId: string
      techId: string
      techName: string
      roomId: string
      date: string
      timeBlock: 'AM' | 'PM'
      notes: string | null
    }
  | {
      type: 'move_assignment'
      assignmentId: string
      techName: string
      fromRoomId: string
      fromDate: string
      fromTimeBlock: 'AM' | 'PM'
      toRoomId: string
      toDate: string
      toTimeBlock: 'AM' | 'PM'
    }
  | {
      type: 'bulk_create'
      assignments: Array<{
        assignmentId: string
        techId: string
        roomId: string
        date: string
        timeBlock: 'AM' | 'PM'
      }>
      techName: string
    };

const MAX_STACK = 50;

export function useUndoRedo() {
  const undoRef = useRef<UndoableAction[]>([]);
  const redoRef = useRef<UndoableAction[]>([]);
  const [counts, setCounts] = useState({ undo: 0, redo: 0 });

  // Push a new action (clears redo stack)
  const push = useCallback((action: UndoableAction) => {
    undoRef.current = [...undoRef.current.slice(-(MAX_STACK - 1)), action];
    redoRef.current = [];
    setCounts({ undo: undoRef.current.length, redo: 0 });
  }, []);

  // Push to undo without clearing redo (used by redo handler)
  const pushUndo = useCallback((action: UndoableAction) => {
    undoRef.current = [...undoRef.current.slice(-(MAX_STACK - 1)), action];
    setCounts(prev => ({ ...prev, undo: undoRef.current.length }));
  }, []);

  // Pop from undo stack
  const popUndo = useCallback((): UndoableAction | null => {
    if (undoRef.current.length === 0) return null;
    const action = undoRef.current[undoRef.current.length - 1];
    undoRef.current = undoRef.current.slice(0, -1);
    setCounts({ undo: undoRef.current.length, redo: redoRef.current.length });
    return action;
  }, []);

  // Push to redo stack (used by undo handler)
  const pushRedo = useCallback((action: UndoableAction) => {
    redoRef.current = [...redoRef.current, action];
    setCounts(prev => ({ ...prev, redo: redoRef.current.length }));
  }, []);

  // Pop from redo stack
  const popRedo = useCallback((): UndoableAction | null => {
    if (redoRef.current.length === 0) return null;
    const action = redoRef.current[redoRef.current.length - 1];
    redoRef.current = redoRef.current.slice(0, -1);
    setCounts({ undo: undoRef.current.length, redo: redoRef.current.length });
    return action;
  }, []);

  // Clear both stacks
  const clear = useCallback(() => {
    undoRef.current = [];
    redoRef.current = [];
    setCounts({ undo: 0, redo: 0 });
  }, []);

  return {
    push,
    pushUndo,
    popUndo,
    pushRedo,
    popRedo,
    clear,
    canUndo: counts.undo > 0,
    canRedo: counts.redo > 0,
  };
}
