'use client';

import React, { useState } from 'react';
import { MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Transaction {
  id: string;
  date: Date;
  description: string;
  subtext: string;
  category: string;
  status: string;
  amount: number;
}

interface TransactionTableProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
}

export function TransactionTable({ transactions, onDelete, onEdit }: TransactionTableProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  return (
    <div className="bg-surface-container-lowest rounded-[2.5rem] overflow-hidden border border-outline-variant/10 shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-container-low/40">
            <th className="px-10 py-6 text-[11px] font-black uppercase tracking-widest text-on-surface-variant/70">Data</th>
            <th className="px-10 py-6 text-[11px] font-black uppercase tracking-widest text-on-surface-variant/70">Descrição</th>
            <th className="px-10 py-6 text-[11px] font-black uppercase tracking-widest text-on-surface-variant/70">Categoria</th>
            <th className="px-10 py-6 text-[11px] font-black uppercase tracking-widest text-on-surface-variant/70 text-right">Valor</th>
            <th className="px-10 py-6 w-16"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/5">
          <AnimatePresence mode="popLayout">
            {transactions.map((t) => (
              <motion.tr 
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -20 }}
                key={t.id} 
                className="hover:bg-surface-container-low/50 transition-colors group cursor-pointer relative"
              >
                <td className="px-10 py-6 text-sm font-semibold text-on-surface-variant">{formatDate(t.date)}</td>
                <td className="px-10 py-6">
                  <div className="font-bold text-on-surface text-base">{t.description}</div>
                </td>
                <td className="px-10 py-6">
                  <span className={cn(
                    "px-4 py-1.5 rounded-full text-[11px] font-bold",
                    t.category === 'Mercado' ? "bg-secondary-container text-on-secondary-container" : 
                    t.category === 'Entretenimento' ? "bg-tertiary-container text-on-tertiary-container" :
                    "bg-surface-container-highest text-on-surface-variant"
                  )}>
                    {t.category}
                  </span>
                </td>
                <td className="px-10 py-6 text-right font-headline font-black text-lg text-tertiary">
                  {formatCurrency(t.amount)}
                </td>
                <td className="px-10 py-6 text-right relative">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenu(activeMenu === t.id ? null : t.id);
                    }}
                    className="text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full hover:bg-surface-container-high"
                  >
                    <MoreVertical size={20} />
                  </button>

                  <AnimatePresence>
                    {activeMenu === t.id && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setActiveMenu(null)}
                        />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-10 top-16 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-xl z-20 py-2 min-w-[140px]"
                        >
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(t);
                              setActiveMenu(null);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm font-bold text-on-surface-variant hover:bg-surface-container-low flex items-center gap-2 transition-colors"
                          >
                            <Edit2 size={16} />
                            Editar
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(t.id);
                              setActiveMenu(null);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm font-bold text-tertiary hover:bg-tertiary/5 flex items-center gap-2 transition-colors"
                          >
                            <Trash2 size={16} />
                            Excluir
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
