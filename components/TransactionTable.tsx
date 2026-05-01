'use client';

import React, { useState, useMemo } from 'react';
import { MoreVertical, Trash2, Edit2, ChevronUp, ChevronDown, SortAsc, SortDesc } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { MaskedValue } from '@/components/MaskedValue';

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
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction; direction: 'asc' | 'desc' } | null>({
    key: 'date',
    direction: 'desc'
  });

  const sortedTransactions = useMemo(() => {
    let sortableItems = [...transactions];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'date') {
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [transactions, sortConfig]);

  const requestSort = (key: keyof Transaction) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Transaction) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <SortAsc size={14} className="opacity-20" />;
    }
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="text-primary" /> : <ChevronDown size={14} className="text-primary" />;
  };

  return (
    <div className="bg-transparent md:bg-surface-container-lowest md:rounded-[2.5rem] md:overflow-hidden md:border md:border-outline-variant/10 md:shadow-sm">
      {/* Mobile Controls */}
      <div className="flex md:hidden items-center justify-between px-2 mb-4">
        <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant/60">Ordenar por:</label>
        <div className="flex gap-2">
          <select 
            className="bg-surface-container-low text-[11px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border-none focus:ring-0"
            value={sortConfig?.key || ''}
            onChange={(e) => requestSort(e.target.value as keyof Transaction)}
          >
            <option value="date">Data</option>
            <option value="description">Descrição</option>
            <option value="category">Categoria</option>
            <option value="amount">Valor</option>
          </select>
          <button 
            onClick={() => setSortConfig(prev => prev ? { ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : null)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low text-primary"
          >
            {sortConfig?.direction === 'asc' ? <SortAsc size={18} /> : <SortDesc size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Card Stacking View */}
      <div className="flex flex-col gap-4 md:hidden">
        <AnimatePresence mode="popLayout">
          {sortedTransactions.map((t) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={t.id}
              className="bg-surface-container-lowest p-5 rounded-[1.5rem] border border-outline-variant/10 shadow-sm relative active:scale-[0.98] transition-transform"
              onClick={() => onEdit(t)}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70 mb-1">
                    {formatDate(t.date)}
                  </div>
                  <h4 className="font-bold text-on-surface text-lg leading-tight line-clamp-2">
                    {t.description}
                  </h4>
                  {t.subtext && (
                    <p className="text-xs text-on-surface-variant font-medium mt-1 uppercase tracking-tight">
                      {t.subtext}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className={cn(
                    "font-headline font-black text-xl",
                    t.amount < 0 ? "text-tertiary" : "text-primary"
                  )}>
                    <MaskedValue value={t.amount} />
                  </div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                    t.category === 'Mercado' ? "bg-secondary-container text-on-secondary-container" : 
                    t.category === 'Entretenimento' ? "bg-tertiary-container text-on-tertiary-container" :
                    "bg-surface-container-highest text-on-surface-variant"
                  )}>
                    {t.category}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/5">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(t);
                  }}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant active:bg-surface-container-high transition-colors"
                  aria-label="Editar"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(t.id);
                  }}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-tertiary/10 text-tertiary active:bg-tertiary/20 transition-colors"
                  aria-label="Excluir"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto pb-16">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-surface-container-low/40">
              <th 
                className="px-6 md:px-10 py-4 md:py-6 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-on-surface-variant/70 cursor-pointer hover:bg-surface-container-high transition-colors"
                onClick={() => requestSort('date')}
              >
                <div className="flex items-center gap-2">
                  Data {getSortIcon('date')}
                </div>
              </th>
              <th 
                className="px-6 md:px-10 py-4 md:py-6 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-on-surface-variant/70 cursor-pointer hover:bg-surface-container-high transition-colors"
                onClick={() => requestSort('description')}
              >
                <div className="flex items-center gap-2">
                  Descrição {getSortIcon('description')}
                </div>
              </th>
              <th 
                className="px-6 md:px-10 py-4 md:py-6 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-on-surface-variant/70 cursor-pointer hover:bg-surface-container-high transition-colors"
                onClick={() => requestSort('category')}
              >
                <div className="flex items-center gap-2">
                  Categoria {getSortIcon('category')}
                </div>
              </th>
              <th 
                className="px-6 md:px-10 py-4 md:py-6 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-on-surface-variant/70 text-right cursor-pointer hover:bg-surface-container-high transition-colors"
                onClick={() => requestSort('amount')}
              >
                <div className="flex items-center justify-end gap-2">
                  Valor {getSortIcon('amount')}
                </div>
              </th>
              <th className="px-6 md:px-10 py-4 md:py-6 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-on-surface-variant/70 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            <AnimatePresence mode="popLayout">
              {sortedTransactions.map((t) => (
                <motion.tr 
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: -20 }}
                  key={t.id} 
                  className="hover:bg-surface-container-low/50 transition-colors group cursor-pointer relative"
                >
                  <td className="px-6 md:px-10 py-4 md:py-6 text-xs md:text-sm font-semibold text-on-surface-variant whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="px-6 md:px-10 py-4 md:py-6">
                    <div className="font-bold text-on-surface text-sm md:text-base line-clamp-1">{t.description}</div>
                    {t.subtext && <div className="text-[10px] md:text-xs text-on-surface-variant font-medium mt-0.5 line-clamp-1">{t.subtext}</div>}
                  </td>
                  <td className="px-6 md:px-10 py-4 md:py-6 whitespace-nowrap">
                    <span className={cn(
                      "px-3 md:px-4 py-1 md:py-1.5 rounded-full text-[10px] md:text-[11px] font-bold",
                      t.category === 'Mercado' ? "bg-secondary-container text-on-secondary-container" : 
                      t.category === 'Entretenimento' ? "bg-tertiary-container text-on-tertiary-container" :
                      "bg-surface-container-highest text-on-surface-variant"
                    )}>
                      {t.category}
                    </span>
                  </td>
                  <td className={cn(
                    "px-6 md:px-10 py-4 md:py-6 text-right font-headline font-black text-base md:text-lg whitespace-nowrap",
                    t.amount < 0 ? "text-tertiary" : "text-primary"
                  )}>
                    <MaskedValue value={t.amount} />
                  </td>
                  <td className="px-6 md:px-10 py-4 md:py-6 text-right">
                    <div className="flex items-center justify-end gap-2 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(t);
                        }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low md:bg-transparent text-primary hover:bg-primary/10 transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(t.id);
                        }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low md:bg-transparent text-tertiary hover:bg-tertiary/10 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
