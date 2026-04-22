'use client';

import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Landmark, Tag, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface Investment {
  id?: string;
  asset_name: string;
  broker: string;
  asset_type: string;
  balance: number;
  reference_date: string;
}

interface InvestmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Investment) => void;
  editingInvestment?: Investment | null;
}

const ASSET_TYPES = ['Ações', 'FIIs', 'Renda Fixa', 'Tesouro', 'Cripto', 'Outros'];

const maskCurrency = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const amount = parseInt(digits, 10) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
};

const parseCurrency = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
};

export function InvestmentModal({ isOpen, onClose, onSave, editingInvestment }: InvestmentModalProps) {
  const [formData, setFormData] = useState({
    asset_name: editingInvestment?.asset_name || '',
    broker: editingInvestment?.broker || '',
    asset_type: editingInvestment?.asset_type || 'Renda Fixa',
    balance: editingInvestment ? maskCurrency((editingInvestment.balance * 100).toFixed(0)) : '',
    reference_date: editingInvestment?.reference_date || new Date().toISOString().split('T')[0].substring(0, 7) + '-01',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: editingInvestment?.id,
      asset_name: formData.asset_name,
      broker: formData.broker,
      asset_type: formData.asset_type,
      balance: parseCurrency(formData.balance),
      reference_date: formData.reference_date,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-surface-container-lowest rounded-[2.5rem] shadow-2xl overflow-hidden border border-outline-variant/10"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black font-headline text-primary tracking-tight">
                  {editingInvestment ? 'Editar Ativo' : 'Novo Ativo'}
                </h3>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Nome do Ativo / Ticker</label>
                  <div className="relative">
                    <TrendingUp className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={20} />
                    <input
                      required
                      type="text"
                      value={formData.asset_name}
                      onChange={(e) => setFormData({ ...formData, asset_name: e.target.value })}
                      className="w-full pl-12 pr-6 py-4 bg-surface-container-high border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                      placeholder="Ex: PETR4, CDB Itaú, IVVB11"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Corretora</label>
                    <div className="relative">
                      <Landmark className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18} />
                      <input
                        required
                        type="text"
                        value={formData.broker}
                        onChange={(e) => setFormData({ ...formData, broker: e.target.value })}
                        className="w-full pl-12 pr-6 py-4 bg-surface-container-high border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                        placeholder="Ex: XP, Itaú, BTG"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Categoria</label>
                    <div className="relative">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18} />
                      <select
                        value={formData.asset_type}
                        onChange={(e) => setFormData({ ...formData, asset_type: e.target.value })}
                        className="w-full pl-12 pr-6 py-4 bg-surface-container-high border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-bold appearance-none"
                      >
                        {ASSET_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Saldo Atual</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={20} />
                      <input
                        required
                        type="text"
                        value={formData.balance}
                        onChange={(e) => setFormData({ ...formData, balance: maskCurrency(e.target.value) })}
                        className="w-full pl-12 pr-6 py-4 bg-surface-container-high border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-bold text-lg"
                        placeholder="R$ 0,00"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Mês de Referência</label>
                    <input
                      required
                      type="date"
                      value={formData.reference_date}
                      onChange={(e) => {
                        // Ensure it's always the first day of the month
                        const date = new Date(e.target.value);
                        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
                        setFormData({ ...formData, reference_date: firstDay });
                      }}
                      className="w-full px-6 py-4 bg-surface-container-high border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-4 rounded-2xl bg-surface-container-high text-on-surface font-bold hover:bg-surface-container-highest transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-4 rounded-2xl bg-primary text-on-primary font-bold shadow-lg shadow-primary/20 hover:scale-[0.98] transition-all"
                  >
                    {editingInvestment ? 'Salvar Alterações' : 'Salvar Ativo'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
