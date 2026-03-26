'use client';

import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export function InsightCard() {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className="mt-16 p-10 bg-surface-container-low rounded-[3rem] flex flex-col md:flex-row items-center gap-10 border border-white/60 shadow-sm"
    >
      <div className="w-28 h-28 rounded-full bg-primary-fixed flex items-center justify-center shrink-0 shadow-inner">
        <Sparkles size={48} className="text-primary fill-primary/10" />
      </div>
      <div className="flex-1">
        <h3 className="text-2xl font-black font-headline mb-3 text-primary tracking-tight">Insight do Atelier Fiscal</h3>
        <p className="text-on-surface-variant text-base leading-relaxed max-w-2xl font-medium">
          Seus gastos com entretenimento estão 12% acima da sua linha de base definida para outubro. 
          Considere realocar do seu orçamento variável de transporte para manter sua meta de economia líquida de 15% para este trimestre.
        </p>
        <div className="mt-6 flex items-center gap-8">
          <button className="text-sm font-black text-primary flex items-center gap-2 hover:translate-x-1 transition-transform">
            Revisar Orçamento <ArrowRight size={16} />
          </button>
          <button className="text-sm font-black text-on-surface-variant/60 hover:text-on-surface-variant transition-colors">
            Descartar
          </button>
        </div>
      </div>
    </motion.div>
  );
}
