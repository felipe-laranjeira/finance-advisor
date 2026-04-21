'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

interface Transaction {
  id: string;
  date: Date;
  description: string;
  subtext: string;
  category: string;
  status: string;
  amount: number;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id'> & { id?: string }) => void;
  editingTransaction?: Transaction | null;
  type?: 'expense' | 'income' | 'investment';
}

export function TransactionModal({ isOpen, onClose, onSave, editingTransaction, type = 'expense' }: TransactionModalProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const { user } = useAuth();

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

  const [formData, setFormData] = useState({
    description: editingTransaction?.description || '',
    category: editingTransaction?.category || 'Outros',
    amount: editingTransaction ? maskCurrency((Math.abs(editingTransaction.amount) * 100).toFixed(0)) : '',
    date: editingTransaction ? new Date(editingTransaction.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    let mounted = true;
    const fetchCategories = async () => {
      const categoryTable = type === 'income' ? 'incoming_categories' : 'categories';
      const { data, error } = await supabase
        .from(categoryTable)
        .select('name')
        .order('name');
      
      if (error) {
        console.error(`Error fetching ${categoryTable}:`, error);
        if (mounted) {
          const fallbacks = type === 'income' 
            ? ['Salário', 'Freelance', 'Dividendos', 'Aluguel', 'Investimentos', 'Outros']
            : ['Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Moradia', 'Outros'];
          setCategories(fallbacks);
        }
        return;
      }

      if (data && mounted) {
        setCategories(data.map((c: any) => c.name));
      }
    };
    fetchCategories();
    return () => { mounted = false; };
  }, [type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseCurrency(formData.amount);
    const finalAmount = type === 'expense' ? -Math.abs(amount) : Math.abs(amount);

    onSave({
      id: editingTransaction?.id,
      description: formData.description,
      subtext: '',
      category: formData.category,
      status: 'Pago',
      amount: finalAmount,
      date: new Date(formData.date),
    } as any);
    onClose();
  };

  const title = type === 'expense' ? 'Despesa' : type === 'income' ? 'Receita' : 'Investimento';

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
                  {editingTransaction ? `Editar ${title}` : `Nova ${title}`}
                </h3>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Descrição</label>
                  <input
                    required
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-6 py-4 bg-surface-container-high border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    placeholder="Ex: Aluguel Apartamento"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Valor</label>
                    <input
                      required
                      type="text"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: maskCurrency(e.target.value) })}
                      className="w-full px-6 py-4 bg-surface-container-high border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-bold text-lg"
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Data</label>
                    <input
                      required
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-6 py-4 bg-surface-container-high border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Categoria</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-6 py-4 bg-surface-container-high border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
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
                    {editingTransaction ? 'Salvar Alterações' : `Salvar ${title}`}
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
