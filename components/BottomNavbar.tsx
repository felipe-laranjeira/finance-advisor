'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ArrowDownCircle, 
  Receipt, 
  TrendingUp,
  Target,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMask } from '@/components/MaskProvider';

const navItems = [
  { icon: LayoutDashboard, label: 'Painel', href: '/painel' },
  { icon: ArrowDownCircle, label: 'Receitas', href: '/receitas' },
  { icon: Receipt, label: 'Despesas', href: '/despesas' },
  { icon: TrendingUp, label: 'Investimentos', href: '/investimentos' },
  { icon: Target, label: 'Orçamento', href: '/orcamento' },
];

export function BottomNavbar() {
  const pathname = usePathname();

  // Hide Navbar on Login (/) and Registration (/registrar) pages
  const hidePaths = ['/', '/entrar', '/registrar'];
  if (hidePaths.includes(pathname)) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[60] bg-surface-container-lowest border-t border-outline-variant/10 px-4 py-2 lg:hidden shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all relative min-w-[64px]",
                isActive ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-colors",
                isActive ? "bg-primary/10 text-primary" : ""
              )}>
                <Icon size={20} />
              </div>
              <span className={cn(
                "text-[10px] font-bold tracking-tight",
                isActive ? "opacity-100" : "opacity-70"
              )}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute -top-[2px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
