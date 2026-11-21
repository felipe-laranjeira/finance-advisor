'use client';

import React, { useState } from 'react';
import { Sparkles, Shield, Zap, TrendingUp, AlertTriangle, Loader2, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { aiErrorMessage, requestAi } from '@/lib/ai/client';

type RiskProfile = 'Conservador' | 'Moderado' | 'Arrojado';

export function InvestmentAdvisor({ investmentIds }: { investmentIds: string[] }) {
  const [profile, setProfile] = useState<RiskProfile>('Moderado');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  const handleRunAIAnalysis = async () => {
    if (loadingAI) return;

    setLoadingAI(true);
    setAnalysis(null);
    try {
      const result = await requestAi<string>('/api/ai/investments/advisor', { profile, investmentIds });
      setAnalysis(result);
    } catch (error) {
      setAnalysis(aiErrorMessage(error));
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-[2.5rem] border border-outline-variant/10 shadow-sm overflow-hidden mb-12">
      <div className="p-8 md:p-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <Sparkles size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-black font-headline text-on-surface tracking-tight">Alpha Advisor</h3>
              <p className="text-on-surface-variant font-medium">Análise inteligente da sua carteira</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {(['Conservador', 'Moderado', 'Arrojado'] as RiskProfile[]).map((p) => (
              <button
                key={p}
                onClick={() => setProfile(p)}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-sm font-bold transition-all border",
                  profile === p 
                    ? "bg-primary text-on-primary border-primary shadow-lg shadow-primary/20" 
                    : "bg-surface-container-low text-on-surface-variant border-outline-variant/10 hover:bg-surface-container-high"
                )}
              >
                {p}
              </button>
            ))}
            
            <button
              onClick={handleRunAIAnalysis}
              disabled={loadingAI}
              className="ml-2 px-8 py-2.5 rounded-xl bg-on-surface text-surface font-bold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
            >
              {loadingAI ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
              {loadingAI ? 'Analisando...' : 'Gerar Análise'}
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {loadingAI ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-20 flex flex-col items-center justify-center gap-4 text-center"
            >
              <div className="relative">
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" size={24} />
              </div>
              <p className="text-on-surface-variant font-bold animate-pulse">Consultando indicadores e analisando ativos...</p>
            </motion.div>
          ) : analysis ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-container-low rounded-3xl p-8 md:p-10 border border-outline-variant/5"
            >
              <div className="prose prose-slate max-w-none 
                prose-headings:font-black prose-headings:font-headline prose-headings:text-primary prose-headings:tracking-tight
                prose-p:text-on-surface-variant prose-p:leading-relaxed prose-p:font-medium
                prose-strong:text-on-surface prose-strong:font-black
                prose-li:text-on-surface-variant prose-li:font-medium
                prose-code:bg-surface-container-high prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-primary
                prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-primary/5 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:rounded-r-xl
              ">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
              </div>
              
              <div className="mt-10 pt-8 border-t border-outline-variant/10 flex items-center gap-3 text-on-surface-variant/60">
                <Shield size={16} />
                <p className="text-xs font-bold uppercase tracking-widest">Análise protegida por Alpha Security Protocol</p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 px-8 bg-surface-container-low rounded-3xl border border-dashed border-outline-variant/20 text-center"
            >
              <TrendingUp className="mx-auto mb-4 text-on-surface-variant/20" size={48} />
              <h4 className="text-lg font-bold text-on-surface mb-2">Pronto para sua consultoria?</h4>
              <p className="text-on-surface-variant text-sm max-w-md mx-auto">
                Selecione seu perfil de risco e clique em <strong>Gerar Análise</strong> para receber recomendações personalizadas do Alpha Advisor.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
