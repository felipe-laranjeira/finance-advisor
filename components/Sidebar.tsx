'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  ArrowDownCircle, 
  Receipt, 
  BarChart3, 
  Settings, 
  Plus, 
  HelpCircle, 
  LogOut 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const menuItems = [
  { icon: LayoutDashboard, label: 'Painel', href: '#', active: false },
  { icon: ArrowDownCircle, label: 'Receitas', href: '/receitas', active: false },
  { icon: Receipt, label: 'Despesas', href: '/despesas', active: false },
  { icon: BarChart3, label: 'Investimentos', href: '/investimentos', active: false },
  { icon: Settings, label: 'Configurações', href: '#', active: false },
];

export function Sidebar() {
  const router = useRouter();
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 flex flex-col bg-surface-container-low border-r border-outline-variant/10 z-50">
      <div className="flex flex-col h-full py-8 px-4">
        {/* Brand Section */}
        <div className="mb-10 px-4">
          <h1 className="font-black text-primary text-2xl tracking-tight">Financial Advisor</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-bold mt-1">
            O seu assistente financeiro
          </p>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => {
            const isActive = currentPath === item.href;
            return (
              <a
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-all duration-200 rounded-xl text-sm font-medium",
                  isActive 
                    ? "bg-surface-container-lowest text-primary shadow-sm font-bold" 
                    : "text-on-surface-variant hover:bg-surface-container-highest"
                )}
              >
                <item.icon size={20} className={isActive ? "text-primary fill-primary/10" : ""} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* Footer Links */}
        <div className="pt-6 border-t border-outline-variant/20 space-y-1">
          <a className="text-on-surface-variant flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-highest transition-all duration-200 rounded-xl text-sm" href="#">
            <HelpCircle size={18} />
            <span>Central de Ajuda</span>
          </a>
          <button 
            onClick={handleLogout}
            className="w-full text-on-surface-variant flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-highest transition-all duration-200 rounded-xl text-sm"
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
