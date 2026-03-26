'use client';

import React from 'react';
import { TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { motion } from 'motion/react';

interface StatsProps {
  total: number;
  fixed: number;
  variable: number;
}

export function Stats({ total, fixed, variable }: StatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="md:col-span-2 bg-gradient-to-br from-primary to-primary-container p-8 rounded-[2.5rem] text-on-primary shadow-2xl shadow-primary/20 relative overflow-hidden"
      >
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-8">
            <p className="text-sm font-medium opacity-80">Despesas Totais (Mês Atual)</p>
            <TrendingDown size={24} className="opacity-60" />
          </div>
          <p className="text-5xl font-extrabold font-headline mb-6 tracking-tight">
            {formatCurrency(total)}
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="bg-white/20 px-3 py-1 rounded-full font-semibold backdrop-blur-sm">
              8.2% vs mês passado
            </span>
          </div>
        </div>
        {/* Decorative element */}
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-surface-container-low p-8 rounded-[2.5rem] border border-outline-variant/10"
      >
        <p className="text-sm text-on-surface-variant font-semibold mb-2">Custos Fixos</p>
        <p className="text-3xl font-bold font-headline text-on-surface">{formatCurrency(fixed)}</p>
        <div className="mt-6 h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
          <div className="h-full bg-primary w-2/3 rounded-full"></div>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-surface-container-low p-8 rounded-[2.5rem] border border-outline-variant/10"
      >
        <p className="text-sm text-on-surface-variant font-semibold mb-2">Custos Variáveis</p>
        <p className="text-3xl font-bold font-headline text-on-surface">{formatCurrency(variable)}</p>
        <div className="mt-6 h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
          <div className="h-full bg-tertiary w-1/3 rounded-full"></div>
        </div>
      </motion.div>
    </div>
  );
}
