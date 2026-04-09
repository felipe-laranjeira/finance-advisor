'use client';

import React from 'react';
import { MoreVertical, Edit2, Trash2, Landmark, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

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
  return (
    <div className="bg-surface-container-lowest rounded-[2.5rem] border border-outline-variant/10 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant/5">
              <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-on-surface-variant/60">Ativo / Corretora</th>
              <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-on-surface-variant/60">Categoria</th>
              <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-on-surface-variant/60 text-right">Saldo Consolidado</th>
              <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-on-surface-variant/60 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {investments.map((investment) => (
              <tr key={investment.id} className="group hover:bg-surface-container-low/50 transition-colors">
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
                    {formatCurrency(investment.balance)}
                  </p>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onEdit(investment)}
                      className="p-2 rounded-xl hover:bg-primary/10 text-primary transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => onDelete(investment.id)}
                      className="p-2 rounded-xl hover:bg-error/10 text-error transition-colors"
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
