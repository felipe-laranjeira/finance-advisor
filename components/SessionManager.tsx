'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthProvider';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Clock, ShieldCheck, LogOut } from 'lucide-react';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_TIMEOUT_MS = 25 * 60 * 1000; // 25 minutes (5 min before expiry)

export function SessionManager() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [showWarning, setShowWarning] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetSession = useCallback(() => {
    setLastActivity(Date.now());
    setShowWarning(false);
  }, []);

  // Reset session on page navigation
  useEffect(() => {
    if (user) {
      resetSession();
    }
  }, [pathname, user, resetSession]);

  useEffect(() => {
    if (!user) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      setShowWarning(false);
      return;
    }

    const handleInteraction = () => {
      // Only reset if we are not currently showing the warning
      // If warning is shown, user must explicitly confirm
      if (!showWarning) {
        resetSession();
      }
    };

    window.addEventListener('mousemove', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('scroll', handleInteraction);
    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);

    // Setup timers
    const timeSinceLastActivity = Date.now() - lastActivity;
    
    // Clear existing
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);

    // Warning timer
    const remainingToWarning = Math.max(0, WARNING_TIMEOUT_MS - timeSinceLastActivity);
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
    }, remainingToWarning);

    // Absolute timeout timer
    const remainingToTimeout = Math.max(0, SESSION_TIMEOUT_MS - timeSinceLastActivity);
    timerRef.current = setTimeout(() => {
      signOut();
    }, remainingToTimeout);

    return () => {
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, [user, lastActivity, showWarning, resetSession, signOut]);

  return (
    <AnimatePresence>
      {showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-on-surface/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-surface-container-lowest rounded-[2.5rem] shadow-2xl overflow-hidden border border-outline-variant/10 p-8"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                <Clock className="text-primary w-10 h-10 animate-pulse" />
              </div>
              
              <h3 className="text-2xl font-black font-headline text-on-surface tracking-tight mb-2">
                Sua sessão expira em breve
              </h3>
              
              <p className="text-on-surface-variant font-medium mb-8">
                Por questões de segurança, sua sessão será encerrada em menos de 5 minutos por inatividade. Deseja continuar conectado?
              </p>

              <div className="flex flex-col w-full gap-3">
                <button
                  onClick={resetSession}
                  className="w-full py-4 rounded-2xl bg-primary text-on-primary font-bold shadow-lg shadow-primary/20 hover:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <ShieldCheck size={20} />
                  Sim, permanecer logado
                </button>
                <button
                  onClick={() => signOut()}
                  className="w-full py-4 rounded-2xl bg-surface-container-high text-on-surface-variant font-bold hover:bg-surface-container-highest transition-all flex items-center justify-center gap-2"
                >
                  <LogOut size={20} />
                  Sair agora
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
