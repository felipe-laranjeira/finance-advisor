'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Mail, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';

import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loading: authLoading, login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao fazer login');
      }

      login(data);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>;
  }

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen flex flex-col">
      {/* TopNavBar */}
      <nav className="w-full top-0 left-0 bg-transparent z-50">
        <div className="flex justify-between items-center max-w-7xl mx-auto px-8 py-6 w-full">
          <div className="text-2xl font-bold tracking-tighter text-primary font-headline">
            Financial Advisor
          </div>
        </div>
      </nav>

      {/* Main Content: Split Layout */}
      <main className="flex-grow flex items-center justify-center px-6 lg:px-0">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 bg-surface-container-lowest rounded-3xl overflow-hidden shadow-2xl shadow-on-surface/5">
          {/* Left Side: Visual/Branding (Desktop Only) */}
          <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary to-primary-container relative overflow-hidden">
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://lh3.googleusercontent.com/aida-public/AB6AXuBS9xpwwtey6RbAy_90e0FWVbhr9aa015sP_9qU-AYOhgNrGQpxVTr68JUXpFMdalaeR3pP2j8JKuPdJ4dKhvXPjZGfv93TqSlhjwvLLeD3PFJGcD6cNVGxTSdsxs6AVkH2U63Z_Yf5vNCnyJTpdS3dGO-ua6U9lgw_Ur2LUH9aw1SkalNryIuoEpVGoc9XpaaK7rSAENOWxq9lrke2vFuB_LmwwUnvAxvsGyH6n_JyzdwQdovRGxZAh4i-mghGZOMjkPraQhI8E9zh')] bg-cover">
            </div>
            <div className="relative z-10">
              <h2 className="text-4xl font-headline font-extrabold text-white tracking-tight leading-tight mb-4">
                A arte da precisão <br/>em cada detalhe fiscal.
              </h2>
              <p className="text-primary-fixed/80 max-w-sm text-lg font-light">
                Transforme sua gestão financeira com o Atelier de inteligência que esculpe sua prosperidade.
              </p>
            </div>
            <div className="relative z-10 bg-white/10 backdrop-blur-xl p-6 rounded-2xl border border-white/10">
              <div className="flex items-center gap-4 mb-3">
                <div className="h-10 w-10 rounded-full bg-secondary-fixed flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-secondary-container">verified_user</span>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Segurança de Nível Bancário</p>
                  <p className="text-white/60 text-xs text-wrap">Seus dados protegidos por criptografia de ponta a ponta.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Login Form */}
          <div className="p-8 md:p-16 flex flex-col justify-center">
            <div className="max-w-md w-full mx-auto">
              <div className="mb-10">
                <h1 className="text-3xl font-headline font-extrabold text-on-surface mb-2">Financial Advisor</h1>
                <p className="text-on-surface-variant text-sm">O seu assistente financeiro</p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-error text-white rounded-xl text-sm shadow-lg shadow-error/20">
                  {error}
                </div>
              )}

              <form className="space-y-6" onSubmit={handleLogin}>
                {/* Email Field */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider" htmlFor="email">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={20} />
                    <input
                      className="w-full pl-12 pr-4 py-3.5 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-outline/60"
                      id="email"
                      placeholder="nome@exemplo.com"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                {/* Password Field */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider" htmlFor="password">Senha</label>
                    <a className="text-xs font-medium text-primary hover:underline decoration-primary/30" href="#">Esqueci minha senha</a>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={20} />
                    <input
                      className="w-full pl-12 pr-4 py-3.5 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-outline/60"
                      id="password"
                      placeholder="••••••••"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                {/* Remember Me */}
                <div className="flex items-center">
                  <input className="w-4 h-4 text-primary bg-surface-container-high border-none rounded focus:ring-primary/30" id="remember" type="checkbox"/>
                  <label className="ml-2 text-sm text-on-surface-variant" htmlFor="remember">Lembrar de mim</label>
                </div>
                {/* Login Button */}
                <button
                  className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary py-4 rounded-xl font-headline font-bold text-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] transition-all disabled:opacity-50"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-sm text-on-surface-variant">
                  Não tem uma conta? <Link href="/registrar" className="text-primary font-bold hover:underline decoration-primary/30">Registrar sua Conta</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-container-low border-t border-outline-variant/20 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto px-8 py-12 w-full gap-6">
          <div className="text-lg font-bold text-primary font-headline">
            Financial Advisor
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <a className="text-xs font-normal tracking-wide text-on-surface-variant hover:underline decoration-primary/30 transition-opacity opacity-80 hover:opacity-100" href="#">Privacy Policy</a>
            <a className="text-xs font-normal tracking-wide text-on-surface-variant hover:underline decoration-primary/30 transition-opacity opacity-80 hover:opacity-100" href="#">Terms of Service</a>
            <a className="text-xs font-normal tracking-wide text-on-surface-variant hover:underline decoration-primary/30 transition-opacity opacity-80 hover:opacity-100" href="#">Cookie Settings</a>
            <a className="text-xs font-normal tracking-wide text-on-surface-variant hover:underline decoration-primary/30 transition-opacity opacity-80 hover:opacity-100" href="#">Global Compliance</a>
          </div>
          <p className="text-xs font-normal tracking-wide text-on-surface-variant text-center md:text-right">
            © 2024 Financial Advisor. All rights reserved. Precision in Prosperity.
          </p>
        </div>
      </footer>
    </div>
  );
}
