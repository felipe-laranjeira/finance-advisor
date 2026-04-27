'use client';

import React, { useState, useRef, useEffect } from 'react';
import { User as UserIcon, LogOut, ShieldCheck, UserCog } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import { motion, AnimatePresence } from 'motion/react';

export function TopBar() {
  const { user, signOut, updateUser } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [profileData, setProfileData] = useState({ 
    name: user?.name || '', 
    email: user?.email || '',
    currentPassword: ''
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setProfileData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || ''
      }));
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/user/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user?.id, 
          name: profileData.name, 
          email: profileData.email,
          currentPassword: profileData.currentPassword
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao atualizar perfil');

      updateUser({ name: data.user.name, email: data.user.email });
      setSuccess('Perfil atualizado com sucesso!');
      setProfileData(prev => ({ ...prev, currentPassword: '' }));
      setTimeout(() => {
        setShowProfileModal(false);
        setSuccess(null);
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('As novas senhas não coincidem');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/user/change-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user?.id, 
          currentPassword: passwordData.currentPassword, 
          newPassword: passwordData.newPassword 
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao alterar senha');

      setSuccess('Senha alterada com sucesso!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setShowPasswordModal(false);
        setSuccess(null);
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="w-full h-20 flex items-center justify-between px-4 md:px-10 sticky top-0 z-40 glass border-b border-outline-variant/5">
        <div className="flex items-center gap-4 md:gap-6 min-w-0">
          {/* User Name for Mobile/Tablet (Left side) */}
          <div className="lg:hidden flex items-center min-w-0">
            <p className="text-sm font-black text-on-surface tracking-tight leading-tight truncate max-w-[180px]">
              {user?.name && user.name.trim() !== "" ? user.name : 'Bem-vindo'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-5">
          <div className="hidden lg:block mr-2 text-right">
            <p className="text-sm font-bold text-on-surface leading-tight">{user?.name || 'Usuário'}</p>
          </div>
          
          <div className="relative" ref={dropdownRef}>
            <div 
              onClick={() => setShowDropdown(!showDropdown)}
              className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-primary/5 flex items-center justify-center border border-outline-variant/20 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/10 transition-all"
            >
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

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute right-0 mt-3 w-64 bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/10 overflow-hidden z-50 p-2"
                >
                  <div className="p-4 border-b border-outline-variant/5">
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Perfil</p>
                    <p className="text-sm font-bold text-on-surface truncate">{user?.name}</p>
                    <p className="text-[11px] text-on-surface-variant truncate">{user?.email}</p>
                  </div>
                  
                  <div className="p-1 space-y-1">
                    <button 
                      onClick={() => { setShowDropdown(false); setShowProfileModal(true); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-on-surface hover:bg-surface-container-highest transition-colors"
                    >
                      <UserCog size={18} className="text-primary" />
                      Alterar Dados Pessoais
                    </button>
                    <button 
                      onClick={() => { setShowDropdown(false); setShowPasswordModal(true); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-on-surface hover:bg-surface-container-highest transition-colors"
                    >
                      <ShieldCheck size={18} className="text-secondary" />
                      Alterar Senha
                    </button>
                    <div className="h-px bg-outline-variant/5 my-1" />
                    <button 
                      onClick={signOut}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-error hover:bg-error/5 transition-colors"
                    >
                      <LogOut size={18} />
                      Sair
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Modals outside header to ensure full-screen overlay */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-surface-container-lowest w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-8 my-auto"
            >
              <h2 className="text-2xl font-headline font-extrabold text-on-surface mb-2">Alterar Dados</h2>
              <p className="text-on-surface-variant text-sm mb-8">Mantenha suas informações atualizadas.</p>
              
              {error && <div className="mb-4 p-3 bg-error text-white text-xs rounded-xl">{error}</div>}
              {success && <div className="mb-4 p-3 bg-primary text-white text-xs rounded-xl">{success}</div>}

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">Nome</label>
                  <input 
                    className="w-full px-5 py-3 bg-surface-container-highest border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20" 
                    value={profileData.name || ''}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">E-mail</label>
                  <input 
                    className="w-full px-5 py-3 bg-surface-container-highest border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20" 
                    type="email"
                    value={profileData.email || ''}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">Senha Atual para Confirmar</label>
                  <input 
                    className="w-full px-5 py-3 bg-surface-container-highest border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20" 
                    type="password"
                    placeholder="Sua senha atual"
                    value={profileData.currentPassword || ''}
                    onChange={(e) => setProfileData({ ...profileData, currentPassword: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowProfileModal(false)}
                    className="px-6 py-3 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="px-6 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showPasswordModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-surface-container-lowest w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-8 my-auto"
            >
              <h2 className="text-2xl font-headline font-extrabold text-on-surface mb-2">Alterar Senha</h2>
              <p className="text-on-surface-variant text-sm mb-8">Segurança em primeiro lugar.</p>
              
              {error && <div className="mb-4 p-3 bg-error text-white text-xs rounded-xl">{error}</div>}
              {success && <div className="mb-4 p-3 bg-primary text-white text-xs rounded-xl">{success}</div>}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">Senha Atual</label>
                  <input 
                    className="w-full px-5 py-3 bg-surface-container-highest border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20" 
                    type="password"
                    value={passwordData.currentPassword || ''}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">Nova Senha</label>
                  <input 
                    className="w-full px-5 py-3 bg-surface-container-highest border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20" 
                    type="password"
                    value={passwordData.newPassword || ''}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">Confirmar Nova Senha</label>
                  <input 
                    className="w-full px-5 py-3 bg-surface-container-highest border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20" 
                    type="password"
                    value={passwordData.confirmPassword || ''}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowPasswordModal(false)}
                    className="px-6 py-3 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="px-6 py-3 bg-secondary text-on-secondary rounded-xl text-sm font-bold shadow-lg shadow-secondary/20 hover:shadow-secondary/40 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Alterando...' : 'Alterar Senha'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
