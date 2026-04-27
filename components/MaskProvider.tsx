'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface MaskContextType {
  isMasked: boolean;
  toggleMask: () => void;
}

const MaskContext = createContext<MaskContextType | undefined>(undefined);

export function MaskProvider({ children }: { children: React.ReactNode }) {
  const [isMasked, setIsMasked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedState = localStorage.getItem('is_masked');
    if (savedState !== null) {
      setIsMasked(savedState === 'true');
    }
    setMounted(true);
  }, []);

  const toggleMask = () => {
    const newState = !isMasked;
    setIsMasked(newState);
    localStorage.setItem('is_masked', String(newState));
  };

  return (
    <MaskContext.Provider value={{ isMasked, toggleMask }}>
      {children}
    </MaskContext.Provider>
  );
}

export function useMask() {
  const context = useContext(MaskContext);
  if (context === undefined) {
    throw new Error('useMask must be used within a MaskProvider');
  }
  return context;
}
