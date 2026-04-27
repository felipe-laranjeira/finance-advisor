'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  ArrowDownCircle, 
  Receipt, 
  BarChart3, 
  Target,
  Plus, 
  LogOut,
  ChevronLeft,
  Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useLayout } from '@/components/LayoutProvider';
import Link from 'next/link';

const menuItems = [
  { icon: LayoutDashboard, label: 'Painel', href: '/painel', active: false },
  { icon: ArrowDownCircle, label: 'Receitas', href: '/receitas', active: false },
  { icon: Receipt, label: 'Despesas', href: '/despesas', active: false },
  { icon: BarChart3, label: 'Investimentos', href: '/investimentos', active: false },
  { icon: Target, label: 'Orçamento', href: '/orcamento', active: false },
];

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { isSidebarOpen, toggleSidebar } = useLayout();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <>
      <div className="fixed top-6 left-6 z-[60] md:flex hidden">
        {!isSidebarOpen && (
          <button 
            onClick={toggleSidebar}
            className="p-3 bg-surface-container-high rounded-2xl shadow-lg border border-outline-variant/10 text-primary hover:bg-surface-container-highest transition-all duration-300 transform hover:scale-105"
          >
            <Menu size={24} />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-4 left-4 bottom-4 w-72 hidden md:flex flex-col bg-surface-container-high rounded-3xl shadow-2xl border border-outline-variant/10 z-50"
          >
            <div className="flex flex-col h-full py-8 px-4">
                {/* Brand Section */}
                <div className="mb-10 px-4 flex justify-between items-center">
                  <div>
                    <h1 className="font-black text-primary text-2xl tracking-tight">Financial Advisor</h1>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-bold mt-1">
                      O seu assistente financeiro
                    </p>
                  </div>
                  <button 
                    onClick={toggleSidebar}
                    className="p-2 bg-primary/10 hover:bg-primary/20 rounded-xl transition-all duration-300 text-primary flex items-center gap-1 font-bold border border-primary/20 shadow-sm"
                    title="Recolher Menu"
                  >
                    <ChevronLeft size={20} className="stroke-[3px]" />
                    <span className="text-[10px] uppercase tracking-wider mr-1">Recolher</span>
                  </button>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 space-y-2">
                  {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
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
                      </Link>
                    );
                  })}
                </nav>

                {/* Footer Links */}
                <div className="pt-6 border-t border-outline-variant/20 space-y-1">
                  <button 
                    onClick={handleLogout}
                    className="w-full text-on-surface-variant flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-highest transition-all duration-200 rounded-xl text-sm"
                  >
                    <LogOut size={18} />
                    <span>Sair</span>
                  </button>
                </div>
              </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
