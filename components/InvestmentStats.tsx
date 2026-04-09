'use client';

import React from 'react';
import { TrendingUp, PieChart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { motion } from 'motion/react';

interface InvestmentStatsProps {
  total: number;
  categoryTotals: Record<string, number>;
}

export function InvestmentStats({ total, categoryTotals }: InvestmentStatsProps) {
  const categories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
      {/* Total Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="md:col-span-2 bg-gradient-to-br from-primary to-primary-container p-8 rounded-[2.5rem] text-on-primary shadow-2xl shadow-primary/20 relative overflow-hidden"
      >
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-8">
            <p className="text-sm font-medium opacity-80">Patrimônio Consolidado</p>
            <TrendingUp size={24} className="opacity-60" />
          </div>
          <p className="text-5xl font-extrabold font-headline mb-6 tracking-tight">
            {formatCurrency(total)}
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="bg-white/20 px-3 py-1 rounded-full font-semibold backdrop-blur-sm">
              Soma de todos os ativos
            </span>
          </div>
        </div>
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
      </motion.div>

      {/* Category Breakdown Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="md:col-span-2 bg-surface-container-lowest p-8 rounded-[2.5rem] border border-outline-variant/10 shadow-sm relative overflow-hidden"
      >
        <div className="relative z-10 h-full flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <p className="text-sm font-bold text-primary uppercase tracking-widest">Distribuição por Categoria</p>
            <PieChart size={20} className="text-primary opacity-60" />
          </div>
          
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 flex-1 content-center">
            {categories.length > 0 ? (
              categories.map(([category, amount]) => (
                <div key={category} className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-wider text-primary/60 mb-0.5">{category}</span>
                  <span className="text-lg font-black text-primary font-headline leading-none">
                    {formatCurrency(amount)}
                  </span>
                </div>
              ))
            ) : (
              <div className="col-span-2 flex items-center justify-center h-full">
                <p className="text-primary/70 text-sm font-medium italic">Nenhum dado disponível</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
