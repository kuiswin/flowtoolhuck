import { useState, useCallback, useRef } from 'react';
import { AppState } from '../types';

export function useHistory(initialState: AppState) {
  const [current, setCurrent] = useState<AppState>(initialState);
  const history = useRef<AppState[]>([initialState]);
  const pointer = useRef(0);

  const pushState = useCallback((nextState: AppState) => {
    // Only push if different from current to avoid redundant snapshots
    if (JSON.stringify(nextState) === JSON.stringify(history.current[pointer.current])) return;

    // Remove any future states (redo history)
    const newHistory = history.current.slice(0, pointer.current + 1);
    newHistory.push(nextState);
    
    // Limit history size to 50 items
    if (newHistory.length > 50) newHistory.shift();
    
    history.current = newHistory;
    pointer.current = newHistory.length - 1;
    setCurrent(nextState);
  }, []);

  const undo = useCallback(() => {
    if (pointer.current > 0) {
      pointer.current -= 1;
      setCurrent(history.current[pointer.current]);
    }
  }, []);

  const redo = useCallback(() => {
    if (pointer.current < history.current.length - 1) {
      pointer.current += 1;
      setCurrent(history.current[pointer.current]);
    }
  }, []);

  const canUndo = pointer.current > 0;
  const canRedo = pointer.current < history.current.length - 1;

  return { 
    state: current, 
    setState: setCurrent,
    pushState, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  };
}