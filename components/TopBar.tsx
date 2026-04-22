'use client';

import React from 'react';
import { Search, Bell, Wallet, User as UserIcon } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';

export function TopBar() {
  const { user } = useAuth();

  return (
    <header className="w-full h-20 flex items-center justify-between px-4 md:px-10 sticky top-0 z-40 glass border-b border-outline-variant/5">
      <div className="flex items-center gap-4 md:gap-6">
        <div className="relative group hidden sm:block">
          <span className="absolute inset-y-0 left-4 flex items-center text-on-surface-variant">
            <Search size={18} />
          </span>
          <input 
            className="pl-12 pr-6 py-2.5 bg-surface-container-highest border-none rounded-full text-sm focus:ring-2 focus:ring-primary/20 sm:w-64 md:w-80 transition-all placeholder:text-on-surface-variant/60" 
            placeholder="Pesquisar..." 
            type="text"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-2 md:gap-5">
        <div className="hidden lg:block mr-2 text-right">
          <p className="text-sm font-bold text-on-surface leading-tight">{user?.name || 'Usuário'}</p>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Logado</p>
        </div>
        
        <button className="p-2 md:p-2.5 rounded-full hover:bg-surface-container-highest transition-colors relative text-on-surface-variant">
          <Bell size={20} />
          <span className="absolute top-2 md:top-2.5 right-2 md:right-2.5 w-2 h-2 bg-tertiary rounded-full border-2 border-white"></span>
        </button>
        <button className="p-2 md:p-2.5 rounded-full hover:bg-surface-container-highest transition-colors text-on-surface-variant">
          <Wallet size={20} />
        </button>
        <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-primary/5 flex items-center justify-center border border-outline-variant/20 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/10 transition-all">
          {user?.photo_url ? (
            <Image 
              alt="Avatar do usuário" 
              className="w-full h-full object-cover" 
              src={user.photo_url}
              width={40}
              height={40}
              referrerPolicy="no-referrer"
            />
          ) : (
            <UserIcon size={20} className="text-primary" />
          )}
        </div>
      </div>
    </header>
  );
}
