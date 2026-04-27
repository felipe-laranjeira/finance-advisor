'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface LayoutContextType {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedState = localStorage.getItem('sidebar_open');
    if (savedState !== null) {
      setIsSidebarOpen(savedState === 'true');
    }
    setMounted(true);
  }, []);

  const toggleSidebar = () => {
    const newState = !isSidebarOpen;
    setIsSidebarOpen(newState);
    localStorage.setItem('sidebar_open', String(newState));
  };

  return (
    <LayoutContext.Provider value={{ isSidebarOpen, toggleSidebar }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}
