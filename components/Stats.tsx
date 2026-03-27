'use client';

import React from 'react';
import { TrendingDown } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { motion } from 'motion/react';

interface StatsProps {
  total: number;
  currentMonthTotal: number;
  previousMonthTotal: number;
}

export function Stats({ total, currentMonthTotal, previousMonthTotal }: StatsProps) {
  const diff = currentMonthTotal - previousMonthTotal;
  const isSpendingMore = diff > 0;
  const percentDiff = previousMonthTotal > 0 ? (Math.abs(diff) / previousMonthTotal) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="md:col-span-2 bg-gradient-to-br from-primary to-primary-container p-8 rounded-[2.5rem] text-on-primary shadow-2xl shadow-primary/20 relative overflow-hidden"
      >
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-8">
            <p className="text-sm font-medium opacity-80">Despesas Totais (Filtro Atual)</p>
            <TrendingDown size={24} className="opacity-60" />
          </div>
          <p className="text-5xl font-extrabold font-headline mb-6 tracking-tight">
            {formatCurrency(total)}
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="bg-white/20 px-3 py-1 rounded-full font-semibold backdrop-blur-sm">
              Soma das despesas filtradas
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
        className={cn(
          "md:col-span-2 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden transition-colors duration-500",
          isSpendingMore 
            ? "bg-gradient-to-br from-error to-error-container shadow-error/20" 
            : "bg-gradient-to-br from-secondary to-secondary-container shadow-secondary/20"
        )}
      >
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-8">
            <p className="text-sm font-medium opacity-80">Comparativo (Mês Atual vs Anterior)</p>
            <TrendingDown size={24} className={cn("opacity-60", isSpendingMore && "rotate-180")} />
          </div>
          <div className="flex items-baseline gap-3 mb-6">
            <p className="text-5xl font-extrabold font-headline tracking-tight">
              {formatCurrency(currentMonthTotal)}
            </p>
            <p className="text-xl font-bold opacity-90">
              ({isSpendingMore ? '+' : '-'}{formatCurrency(Math.abs(diff))})
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="bg-white/20 px-3 py-1 rounded-full font-semibold backdrop-blur-sm">
                {isSpendingMore ? 'Gastando MAIS' : 'Gastando MENOS'} que o mês passado
              </span>
            </div>
            <p className="text-xs opacity-70 font-medium">
              {isSpendingMore ? '+' : '-'}{percentDiff.toFixed(1)}% em relação a {formatCurrency(previousMonthTotal)}
            </p>
          </div>
        </div>
        {/* Decorative element */}
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
      </motion.div>
    </div>
  );
}
