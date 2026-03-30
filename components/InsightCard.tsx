'use client';

import React, { useState } from 'react';
import { Sparkles, ArrowRight, Loader2, X, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface InsightCardProps {
  onReview: (months: number) => void;
  onDiscard: () => void;
  reviewText: string | null;
  isLoading: boolean;
}

export function InsightCard({ onReview, onDiscard, reviewText, isLoading }: InsightCardProps) {
  const [months, setMonths] = useState(3);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className="mt-16 p-10 bg-surface-container-low rounded-[3rem] flex flex-col md:flex-row items-start gap-10 border border-white/60 shadow-sm relative overflow-hidden"
    >
      <div className="w-28 h-28 rounded-full bg-primary-fixed flex items-center justify-center shrink-0 shadow-inner">
        <Sparkles size={48} className={cn("text-primary fill-primary/10", isLoading && "animate-pulse")} />
      </div>
      <div className="flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
          <h3 className="text-2xl font-black font-headline text-primary tracking-tight">Revisão de despesas</h3>
          
          <div className="flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-2xl border border-outline-variant/10">
            <Calendar size={14} className="text-primary" />
            <select 
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              disabled={isLoading}
              className="bg-transparent text-xs font-bold text-on-surface-variant focus:outline-none cursor-pointer disabled:opacity-50"
            >
              <option value={3}>Últimos 3 meses</option>
              <option value={6}>Últimos 6 meses</option>
              <option value={12}>Últimos 12 meses</option>
            </select>
          </div>
        </div>
        
        <AnimatePresence mode="wait">
          {reviewText ? (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-on-surface-variant text-base leading-relaxed max-w-3xl font-medium whitespace-pre-wrap"
            >
              {reviewText}
            </motion.div>
          ) : (
            <motion.p 
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-on-surface-variant text-base leading-relaxed max-w-2xl font-medium"
            >
              Selecione o período e clique em &quot;Revisar Orçamento&quot; para que nossa IA analise suas despesas, identifique desperdícios e sugira como melhor aproveitar seu dinheiro.
            </motion.p>
          )}
        </AnimatePresence>

        <div className="mt-8 flex items-center gap-8">
          <button 
            onClick={() => onReview(months)}
            disabled={isLoading}
            className={cn(
              "text-sm font-black text-primary flex items-center gap-2 hover:translate-x-1 transition-transform disabled:opacity-50 disabled:cursor-not-allowed",
              isLoading && "animate-pulse"
            )}
          >
            {isLoading ? (
              <>Processando... <Loader2 size={16} className="animate-spin" /></>
            ) : (
              <>Revisar Orçamento <ArrowRight size={16} /></>
            )}
          </button>
          
          <button 
            onClick={onDiscard}
            disabled={!reviewText || isLoading}
            className={cn(
              "text-sm font-black transition-colors flex items-center gap-2",
              reviewText && !isLoading 
                ? "text-error hover:text-error/80" 
                : "text-on-surface-variant/30 cursor-not-allowed"
            )}
          >
            <X size={16} /> Descartar
          </button>
        </div>
      </div>
    </motion.div>
  );
}
