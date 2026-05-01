'use client';

import React, { useState, useMemo } from 'react';
import { MoreVertical, Edit2, Trash2, Landmark, TrendingUp, ChevronUp, ChevronDown, SortAsc, SortDesc, Calendar } from 'lucide-react';
import { formatCurrency, formatReferenceDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { MaskedValue } from '@/components/MaskedValue';

interface Investment {
  id: string;
  asset_name: string;
  broker: string;
  asset_type: string;
  balance: number;
  reference_date: string;
}

interface InvestmentTableProps {
  investments: Investment[];
  onDelete: (id: string) => void;
  onEdit: (investment: Investment) => void;
}

export function InvestmentTable({ investments, onDelete, onEdit }: InvestmentTableProps) {
  const [sortConfig, setSortConfig] = useState<{ key: keyof Investment; direction: 'asc' | 'desc' } | null>({
    key: 'reference_date',
    direction: 'desc'
  });

  const sortedInvestments = useMemo(() => {
    let sortableItems = [...investments];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Handle date sorting
        if (sortConfig.key === 'reference_date') {
          aValue = new Date(a.reference_date).getTime();
          bValue = new Date(b.reference_date).getTime();
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
  }, [investments, sortConfig]);

  const requestSort = (key: keyof Investment) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Investment) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <SortAsc size={14} className="opacity-20" />;
    }
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="text-primary" /> : <ChevronDown size={14} className="text-primary" />;
  };

  return (
    <div className="bg-transparent md:bg-surface-container-lowest md:rounded-[2.5rem] md:border md:border-outline-variant/10 md:overflow-hidden md:shadow-sm">
      {/* Mobile Controls */}
      <div className="flex md:hidden items-center justify-between px-2 mb-4">
        <label className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant/60">Ordenar por:</label>
        <div className="flex gap-2">
          <select 
            className="bg-surface-container-lowest text-[11px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border border-outline-variant/10 focus:ring-0"
            value={sortConfig?.key || ''}
            onChange={(e) => requestSort(e.target.value as keyof Investment)}
          >
            <option value="reference_date">Data</option>
            <option value="asset_name">Ativo</option>
            <option value="broker">Corretora</option>
            <option value="asset_type">Categoria</option>
            <option value="balance">Valor</option>
          </select>
          <button 
            onClick={() => setSortConfig(prev => prev ? { ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : null)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-lowest border border-outline-variant/10 text-primary"
          >
            {sortConfig?.direction === 'asc' ? <SortAsc size={18} /> : <SortDesc size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Assets View */}
      <div className="flex flex-col gap-4 md:hidden">
        {sortedInvestments.map((investment) => (
          <div 
            key={investment.id} 
            className="bg-surface-container-lowest p-5 rounded-[1.5rem] border border-outline-variant/10 shadow-sm active:scale-[0.98] transition-all"
            onClick={() => onEdit(investment)}
          >
            <div className="flex justify-between items-start gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h4 className="font-black text-on-surface text-base tracking-tight leading-tight uppercase">
                    {investment.asset_name}
                  </h4>
                  <div className="flex items-center gap-1 text-on-surface-variant text-[10px] font-bold mt-0.5">
                    <Landmark size={10} />
                    {investment.broker}
                  </div>
                  <div className="flex items-center gap-1 text-on-surface-variant text-[9px] font-black uppercase mt-1">
                    <Calendar size={9} />
                    {formatReferenceDate(investment.reference_date)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black text-primary font-headline leading-tight">
                  <MaskedValue value={investment.balance} />
                </div>
                <div className="mt-1 flex justify-end">
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                    investment.asset_type === 'Ações' ? "bg-blue-100 text-blue-700 font-black" :
                    investment.asset_type === 'FIIs' ? "bg-purple-100 text-purple-700 font-black" :
                    investment.asset_type === 'Renda Fixa' ? "bg-green-100 text-green-700 font-black" :
                    investment.asset_type === 'Tesouro' ? "bg-orange-100 text-orange-700 font-black" :
                    "bg-gray-100 text-gray-700 font-black"
                  )}>
                    {investment.asset_type}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/5">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(investment);
                }}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant active:bg-surface-container-high transition-colors"
                aria-label="Editar"
              >
                <Edit2 size={18} />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(investment.id);
                }}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-tertiary/10 text-tertiary active:bg-tertiary/20 transition-colors"
                aria-label="Excluir"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto pb-16">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant/5">
              <th 
                className="px-8 py-6 text-xs font-black uppercase tracking-widest text-on-surface-variant/60 cursor-pointer hover:bg-surface-container-high transition-colors"
                onClick={() => requestSort('reference_date')}
              >
                <div className="flex items-center gap-2">
                  Data Ref. {getSortIcon('reference_date')}
                </div>
              </th>
              <th 
                className="px-8 py-6 text-xs font-black uppercase tracking-widest text-on-surface-variant/60 cursor-pointer hover:bg-surface-container-high transition-colors"
                onClick={() => requestSort('asset_name')}
              >
                <div className="flex items-center gap-2">
                  Ativo / Corretora {getSortIcon('asset_name')}
                </div>
              </th>
              <th 
                className="px-8 py-6 text-xs font-black uppercase tracking-widest text-on-surface-variant/60 cursor-pointer hover:bg-surface-container-high transition-colors"
                onClick={() => requestSort('asset_type')}
              >
                <div className="flex items-center gap-2">
                  Categoria {getSortIcon('asset_type')}
                </div>
              </th>
              <th 
                className="px-8 py-6 text-xs font-black uppercase tracking-widest text-on-surface-variant/60 text-right cursor-pointer hover:bg-surface-container-high transition-colors"
                onClick={() => requestSort('balance')}
              >
                <div className="flex items-center justify-end gap-2">
                  Saldo Consolidado {getSortIcon('balance')}
                </div>
              </th>
              <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-on-surface-variant/60 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {sortedInvestments.map((investment) => (
              <tr key={investment.id} className="group hover:bg-surface-container-low/50 transition-colors">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-2 text-on-surface-variant text-xs font-black uppercase tracking-wider">
                    <Calendar size={14} className="text-primary/50" />
                    {formatReferenceDate(investment.reference_date)}
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary shrink-0 group-hover:scale-110 transition-transform">
                      <TrendingUp size={20} />
                    </div>
                    <div>
                      <p className="font-black text-on-surface tracking-tight">{investment.asset_name}</p>
                      <div className="flex items-center gap-1.5 text-on-surface-variant text-xs font-bold">
                        <Landmark size={12} />
                        {investment.broker}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <span className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-black tracking-wide",
                    investment.asset_type === 'Ações' ? "bg-blue-100 text-blue-700" :
                    investment.asset_type === 'FIIs' ? "bg-purple-100 text-purple-700" :
                    investment.asset_type === 'Renda Fixa' ? "bg-green-100 text-green-700" :
                    investment.asset_type === 'Tesouro' ? "bg-orange-100 text-orange-700" :
                    "bg-gray-100 text-gray-700"
                  )}>
                    {investment.asset_type}
                  </span>
                </td>
                <td className="px-8 py-6 text-right">
                  <p className="text-lg font-black text-on-surface font-headline">
                    <MaskedValue value={investment.balance} />
                  </p>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex items-center justify-end gap-2 transition-opacity">
                    <button 
                      onClick={() => onEdit(investment)}
                      className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-primary/10 text-primary transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => onDelete(investment.id)}
                      className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-error/10 text-error transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
