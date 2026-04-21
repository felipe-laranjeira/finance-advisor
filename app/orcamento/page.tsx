'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { 
  Plus, 
  Save, 
  Trash2, 
  PieChart as PieChartIcon, 
  DollarSign, 
  AlertCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { cn, formatCurrency } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Category {
  id: string;
  name: string;
}

interface Budget {
  category_id: string;
  limit_amount: number;
}

export default function BudgetPage() {
  const { user, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingLimit, setEditingLimit] = useState<{ id: string, value: string } | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // Fetch all expense categories
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('id, name')
        .order('name');

      if (catError) throw catError;
      setCategories(catData || []);

      // Fetch user's budget limits
      const { data: budgetData, error: budgetError } = await supabase
        .from('budgets')
        .select('category_id, limit_amount')
        .eq('user_id', user.id);

      if (budgetError) {
        // If table doesn't exist yet, we'll just have empty budgets
        if (budgetError.code === '42P01') {
          console.warn('Budgets table does not exist yet. Please run migration.');
        } else {
          throw budgetError;
        }
      }
      
      setBudgets(budgetData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalBudget = useMemo(() => {
    return budgets.reduce((acc, b) => acc + Number(b.limit_amount), 0);
  }, [budgets]);

  const budgetWithPercentages = useMemo(() => {
    return categories.map(cat => {
      const budget = budgets.find(b => b.category_id === cat.id);
      const limit = budget ? Number(budget.limit_amount) : 0;
      const percentage = totalBudget > 0 ? (limit / totalBudget) * 100 : 0;
      
      return {
        ...cat,
        limit,
        percentage
      };
    });
  }, [categories, budgets, totalBudget]);

  const handleUpdateLimit = async (categoryId: string, newValue: number) => {
    if (!user) return;
    setSaving(categoryId);
    
    try {
      const { error } = await supabase
        .from('budgets')
        .upsert({
          user_id: user.id,
          category_id: categoryId,
          limit_amount: newValue,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,category_id' });

      if (error) throw error;
      
      // Update local state
      setBudgets(prev => {
        const existing = prev.find(b => b.category_id === categoryId);
        if (existing) {
          return prev.map(b => b.category_id === categoryId ? { ...b, limit_amount: newValue } : b);
        }
        return [...prev, { category_id: categoryId, limit_amount: newValue }];
      });
      
      setEditingLimit(null);
    } catch (error) {
      console.error('Error updating budget:', error);
      alert('Erro ao salvar limite orçamentário.');
    } finally {
      setSaving(null);
    }
  };

  const handleInputChange = (categoryId: string, value: string) => {
    setEditingLimit({ id: categoryId, value });
  };

  const handleBlur = (categoryId: string) => {
    if (editingLimit && editingLimit.id === categoryId) {
      const numericValue = parseFloat(editingLimit.value.replace(',', '.')) || 0;
      handleUpdateLimit(categoryId, numericValue);
    } else {
      setEditingLimit(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 lg:ml-64 bg-surface min-h-screen pb-20">
        <TopBar />
        
        <div className="p-4 md:p-12 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12 md:mb-16">
            <div>
              <h2 className="text-3xl md:text-5xl font-black text-on-surface font-headline tracking-tight mb-3">Orçamento</h2>
              <p className="text-on-surface-variant text-base md:text-lg font-medium">Defina e gerencie seus limites de gastos por categoria.</p>
            </div>
          </div>

          {/* Total Card */}
          <div className="mb-10 md:mb-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-primary text-on-primary p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] shadow-xl shadow-primary/20 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-8 md:p-12 opacity-10 group-hover:opacity-20 transition-opacity">
                <PieChartIcon className="w-20 h-20 md:w-30 md:h-30" />
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4 opacity-80">
                  <DollarSign className="w-5 h-5 md:w-6 md:h-6" />
                  <span className="text-[10px] md:text-sm font-black uppercase tracking-widest">Orçamento Total Planejado</span>
                </div>
                <h3 className="text-4xl md:text-6xl font-black font-headline tracking-tighter">
                  {formatCurrency(totalBudget)}
                </h3>
                <p className="mt-4 text-primary-container text-xs md:text-sm font-medium opacity-90">
                  Soma de todos os limites definidos para suas categorias de despesa.
                </p>
              </div>
            </motion.div>
          </div>

          {/* Budget Table */}
          <div className="bg-surface-container-low rounded-[2rem] md:rounded-[2.5rem] border border-outline-variant/10 overflow-hidden shadow-sm">
            <div className="p-6 md:p-8 border-b border-outline-variant/10 bg-surface-container-lowest/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h3 className="text-lg md:text-xl font-bold font-headline text-on-surface">Plano Orçamentário</h3>
              <div className="flex items-center gap-2 text-on-surface-variant text-xs md:text-sm font-medium">
                <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                Clique no valor para editar
              </div>
            </div>
            
            <div className="overflow-x-auto">
              {loading ? (
                <div className="py-20 flex flex-col items-center gap-4">
                  <Loader2 className="animate-spin text-primary" size={32} />
                  <span className="text-on-surface-variant font-medium">Carregando categorias...</span>
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-surface-container-highest/30">
                      <th className="px-6 md:px-8 py-4 md:py-5 text-[10px] md:text-xs font-black uppercase tracking-widest text-on-surface-variant">Categoria</th>
                      <th className="px-6 md:px-8 py-4 md:py-5 text-[10px] md:text-xs font-black uppercase tracking-widest text-on-surface-variant">Limite de Gasto</th>
                      <th className="px-6 md:px-8 py-4 md:py-5 text-[10px] md:text-xs font-black uppercase tracking-widest text-on-surface-variant">% do Total</th>
                      <th className="px-6 md:px-8 py-4 md:py-5 text-[10px] md:text-xs font-black uppercase tracking-widest text-on-surface-variant text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {budgetWithPercentages.map((item, index) => (
                        <motion.tr 
                          key={item.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="border-b border-outline-variant/5 last:border-0 hover:bg-surface-container-lowest/50 transition-all group"
                        >
                          <td className="px-6 md:px-8 py-4 md:py-6">
                            <span className="text-sm md:text-base font-bold text-on-surface">{item.name}</span>
                          </td>
                          <td className="px-6 md:px-8 py-4 md:py-6 relative">
                            {editingLimit?.id === item.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-primary font-bold text-xs md:text-sm">R$</span>
                                <input
                                  autoFocus
                                  type="text"
                                  value={editingLimit.value}
                                  onChange={(e) => handleInputChange(item.id, e.target.value)}
                                  onBlur={() => handleBlur(item.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleBlur(item.id);
                                    if (e.key === 'Escape') setEditingLimit(null);
                                  }}
                                  className="bg-surface-container-highest border-2 border-primary rounded-xl px-2 md:px-3 py-1 md:py-1.5 w-24 md:w-32 outline-none font-black text-xs md:text-sm text-on-surface shadow-lg"
                                />
                              </div>
                            ) : (
                              <button 
                                onClick={() => {
                                  // Clear field if 0, otherwise show current value
                                  const val = item.limit === 0 ? '' : item.limit.toString();
                                  setEditingLimit({ id: item.id, value: val });
                                }}
                                className="text-sm md:text-base font-black text-on-surface hover:text-primary transition-colors flex items-center gap-2 group/btn"
                              >
                                {formatCurrency(item.limit)}
                                <Plus size={14} className="opacity-0 lg:group-hover/btn:opacity-100 transition-opacity" />
                              </button>
                            )}
                          </td>
                          <td className="px-6 md:px-8 py-4 md:py-6">
                            <div className="flex items-center gap-4">
                              <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden max-w-[80px] md:max-w-[120px]">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${item.percentage}%` }}
                                  className="h-full bg-primary"
                                />
                              </div>
                              <span className="text-[10px] md:text-sm font-black text-on-surface-variant">
                                {item.percentage.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 md:px-8 py-4 md:py-6 text-right">
                            {saving === item.id ? (
                              <Loader2 className="w-4 h-4 md:w-[18px] md:h-[18px] animate-spin text-primary ml-auto" />
                            ) : item.limit > 0 ? (
                              <CheckCircle2 className="w-4 h-4 md:w-[18px] md:h-[18px] text-primary ml-auto opacity-40" />
                            ) : (
                              <div className="w-18 ml-auto" />
                            )}
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
            </div>
            
            {!loading && categories.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center text-on-surface-variant gap-4">
                <AlertCircle size={40} className="opacity-20" />
                <p className="font-medium">Nenhuma categoria encontrada.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
