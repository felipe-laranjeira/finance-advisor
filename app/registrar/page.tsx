'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar conta');
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-surface font-body text-on-surface min-h-screen flex items-center justify-center px-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-surface-container-lowest p-12 rounded-[2.5rem] shadow-2xl shadow-on-surface/5 text-center border border-outline-variant/10"
        >
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="text-primary" size={40} />
          </div>
          <h2 className="text-3xl font-headline font-extrabold text-on-surface mb-4 tracking-tight">Solicitação Enviada!</h2>
          <p className="text-on-surface-variant mb-10 leading-relaxed">
            Sua conta foi criada com sucesso com o status <strong>Inativo</strong>. 
            Aguarde a ativação por um administrador para começar a usar o sistema.
          </p>
          <Link 
            href="/entrar"
            className="inline-flex items-center justify-center w-full bg-primary text-on-primary py-4 rounded-xl font-headline font-bold text-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
          >
            Voltar para o Login
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen flex flex-col">
       <nav className="w-full bg-transparent z-50">
        <div className="flex justify-between items-center max-w-7xl mx-auto px-8 py-6 w-full">
          <Link href="/" className="text-2xl font-bold tracking-tighter text-primary font-headline flex items-center gap-2">
            <ArrowLeft size={20} /> Financial Advisor
          </Link>
        </div>
      </nav>

      <main className="flex-grow flex items-center justify-center px-6">
        <div className="max-w-md w-full">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container-lowest p-10 md:p-12 rounded-[2.5rem] shadow-2xl shadow-on-surface/5 border border-outline-variant/10"
          >
            <div className="mb-10 text-center">
              <h1 className="text-3xl font-headline font-extrabold text-on-surface mb-2 tracking-tight">Criar Conta</h1>
              <p className="text-on-surface-variant text-sm">Preencha seus dados para solicitar acesso</p>
            </div>
            
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-8 p-4 bg-error-container text-on-error-container rounded-2xl text-sm border border-error/10"
              >
                {error}
              </motion.div>
            )}

            <form className="space-y-6" onSubmit={handleRegister}>
              {/* Name Field */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1" htmlFor="name">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={18} />
                  <input 
                    className="w-full pl-12 pr-4 py-4 bg-surface-container-highest border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all text-on-surface placeholder:text-outline/40" 
                    id="name" 
                    placeholder="Seu nome" 
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1" htmlFor="email">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={18} />
                  <input 
                    className="w-full pl-12 pr-4 py-4 bg-surface-container-highest border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all text-on-surface placeholder:text-outline/40" 
                    id="email" 
                    placeholder="exemplo@email.com" 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1" htmlFor="password">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={18} />
                  <input 
                    className="w-full pl-12 pr-4 py-4 bg-surface-container-highest border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all text-on-surface placeholder:text-outline/40" 
                    id="password" 
                    placeholder="••••••••" 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="pt-4">
                <button 
                  className="w-full bg-primary text-on-primary py-5 rounded-2xl font-headline font-bold text-lg shadow-xl shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all disabled:opacity-50" 
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Cadastrando...' : 'Registrar Conta'}
                </button>
              </div>

              <p className="text-center text-sm text-on-surface-variant">
                Já tem uma conta? <Link href="/entrar" className="text-primary font-bold hover:underline">Faça login</Link>
              </p>
            </form>
          </motion.div>
        </div>
      </main>

      <footer className="w-full py-10 opacity-50">
        <p className="text-xs text-center text-on-surface-variant">
          © 2024 Financial Advisor. Precisão em Prosperidade.
        </p>
      </footer>
    </div>
  );
}
