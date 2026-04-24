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
  is_investment: boolean;
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

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // Fetch separated categories
      // Regra: Não ler todas as categorias de investimentos apenas a fixa "Investimentos"
      // Regra: Exibir todas as categorias de despesas exceto "Investimentos"
      const [{ data: expCatsData }, { data: invCatsData }] = await Promise.all([
        supabase.from('transactions_categories').select('id, name').neq('name', 'Investimentos').order('name'),
        supabase.from('investiments_categories').select('id, name').eq('name', 'Investimentos').limit(1)
      ]);

      const expCats = expCatsData || [];
      const invCats = invCatsData || [];

      const allCategories = [
        ...(expCats.map(c => ({ ...c, is_investment: false }))),
        ...(invCats.map(c => ({ ...c, is_investment: true })))
      ];
      setCategories(allCategories as any);

      // Fetch separated budgets
      const [{ data: expBuds }, { data: invBuds }] = await Promise.all([
        supabase.from('expense_budgets').select('category_id, limit_amount').eq('user_id', user.id),
        supabase.from('investment_budgets').select('category_id, limit_amount').eq('user_id', user.id)
      ]);

      const allBudgets = [
        ...(expBuds || []),
        ...(invBuds || [])
      ];
      
      setBudgets(allBudgets);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const budgetWithPercentages = useMemo(() => {
    const expenses = categories.filter(c => !c.is_investment);
    const investments = categories.filter(c => c.is_investment);

    const totalExpenseBudget = budgets
      .filter(b => expenses.some(c => c.id === b.category_id))
      .reduce((acc, b) => acc + Number(b.limit_amount), 0);

    const totalInvestmentBudget = budgets
      .filter(b => investments.some(c => c.id === b.category_id))
      .reduce((acc, b) => acc + Number(b.limit_amount), 0);

    const mapCategory = (cat: Category, total: number) => {
      const budget = budgets.find(b => b.category_id === cat.id);
      const limit = budget ? Number(budget.limit_amount) : 0;
      const percentage = total > 0 ? (limit / total) * 100 : 0;
      
      return {
        ...cat,
        limit,
        percentage
      };
    };

    return {
      expenseBudgets: expenses.map(c => mapCategory(c, totalExpenseBudget)),
      investmentBudgets: investments.map(c => mapCategory(c, totalInvestmentBudget)),
      totalExpenseBudget,
      totalInvestmentBudget
    };
  }, [categories, budgets]);

  const handleUpdateLimit = async (categoryId: string, newValue: number) => {
    if (!user) return;
    setSaving(categoryId);
    
    try {
      const isInvestment = categories.find(c => c.id === categoryId)?.is_investment;
      const tableName = isInvestment ? 'investment_budgets' : 'expense_budgets';

      const { error } = await supabase
        .from(tableName)
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
    setEditingLimit({ id: categoryId, value: maskCurrency(value) });
  };

  const handleBlur = (categoryId: string) => {
    if (editingLimit && editingLimit.id === categoryId) {
      const numericValue = parseCurrency(editingLimit.value);
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
              <h2 className="text-3xl md:text-5xl font-black text-on-surface font-headline tracking-tight mb-3">Gestão de Metas</h2>
              <p className="text-on-surface-variant text-base md:text-lg font-medium">Equilibre sua economia de consumo com sua estratégia de crescimento patrimonial.</p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-container-low p-8 rounded-[2.5rem] border border-outline-variant/10 shadow-sm relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <PieChartIcon className="w-24 h-24 text-tertiary" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4 opacity-80">
                  <DollarSign className="w-5 h-5 text-tertiary" />
                  <span className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Limite de Consumo</span>
                </div>
                <h3 className="text-4xl font-black font-headline text-tertiary tracking-tighter">
                  {formatCurrency(budgetWithPercentages.totalExpenseBudget)}
                </h3>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-primary p-8 rounded-[2.5rem] shadow-xl shadow-primary/20 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <PieChartIcon className="w-24 h-24 text-white" />
              </div>
              <div className="relative z-10 text-on-primary">
                <div className="flex items-center gap-3 mb-4 opacity-80">
                  <DollarSign className="w-5 h-5" />
                  <span className="text-xs font-black uppercase tracking-widest">Meta de Aporte Mensal</span>
                </div>
                <h3 className="text-4xl font-black font-headline tracking-tighter">
                  {formatCurrency(budgetWithPercentages.totalInvestmentBudget)}
                </h3>
              </div>
            </motion.div>
          </div>

          {/* Render Sections */}
          {[
            { 
              title: 'Metas de Despesas', 
              description: 'Foco em economia e redução de custos.', 
              data: budgetWithPercentages.expenseBudgets,
              color: 'tertiary',
              accent: 'bg-tertiary' 
            },
            { 
              title: 'Metas de Investimento', 
              description: 'Foco em bater a meta de aporte patrimonial.', 
              data: budgetWithPercentages.investmentBudgets,
              color: 'secondary',
              accent: 'bg-secondary' 
            }
          ].map((section, sIdx) => (
            <div key={section.title} className={cn("mb-16", sIdx > 0 && "mt-16")}>
              <div className="mb-6 px-2">
                <h3 className={cn("text-2xl font-black font-headline", sIdx === 0 ? "text-tertiary" : "text-primary")}>{section.title}</h3>
                <p className="text-on-surface-variant text-sm font-medium">{section.description}</p>
              </div>

              <div className="bg-surface-container-low rounded-[2rem] md:rounded-[2.5rem] border border-outline-variant/10 overflow-hidden shadow-sm">
                <div className="p-6 md:p-8 border-b border-outline-variant/10 bg-surface-container-lowest/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="text-lg font-bold font-headline text-on-surface">Detalhamento {section.title}</h3>
                  <div className="flex items-center gap-2 text-on-surface-variant text-xs font-medium">
                    <AlertCircle className={cn("w-3.5 h-3.5 md:w-4 md:h-4", sIdx === 0 ? "text-tertiary" : "text-primary")} />
                    Clique no valor para editar
                  </div>
                </div>
                
                <div className="">
                  {loading ? (
                    <div className="py-20 flex flex-col items-center gap-4">
                      <Loader2 className="animate-spin text-primary" size={32} />
                      <span className="text-on-surface-variant font-medium">Carregando categorias...</span>
                    </div>
                  ) : (
                    <>
                      {/* Mobile View */}
                      <div className="md:hidden flex flex-col divide-y divide-outline-variant/10">
                        {section.data.map((item) => (
                          <div key={item.id} className="p-5 flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-bold text-on-surface text-base">{item.name}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="w-16 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${item.percentage}%` }}
                                      className={cn("h-full", section.accent)}
                                    />
                                  </div>
                                  <span className="text-[10px] font-black text-on-surface-variant">
                                    {item.percentage.toFixed(1)}% da seção
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex flex-col items-end">
                                {editingLimit?.id === item.id ? (
                                  <input
                                    autoFocus
                                    type="text"
                                    inputMode="decimal"
                                    value={editingLimit.value}
                                    placeholder="R$ 0,00"
                                    onChange={(e) => handleInputChange(item.id, e.target.value)}
                                    onBlur={() => handleBlur(item.id)}
                                    className="bg-surface-container-highest border-2 border-primary rounded-xl px-2 py-1.5 w-32 outline-none font-black text-xs text-on-surface shadow-md text-right"
                                  />
                                ) : (
                                  <button 
                                    onClick={() => {
                                      const val = item.limit === 0 ? '' : maskCurrency((item.limit * 100).toFixed(0));
                                      setEditingLimit({ id: item.id, value: val });
                                    }}
                                    className={cn("text-lg font-black flex items-center gap-1 active:scale-95 transition-transform", sIdx === 0 ? "text-tertiary" : "text-primary")}
                                  >
                                    {formatCurrency(item.limit)}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop View */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[500px]">
                          <thead>
                            <tr className="bg-surface-container-highest/30">
                              <th className="px-6 md:px-8 py-4 md:py-5 text-[10px] md:text-xs font-black uppercase tracking-widest text-on-surface-variant">Categoria</th>
                              <th className="px-6 md:px-8 py-4 md:py-5 text-[10px] md:text-xs font-black uppercase tracking-widest text-on-surface-variant">Meta / Limite</th>
                              <th className="px-6 md:px-8 py-4 md:py-5 text-[10px] md:text-xs font-black uppercase tracking-widest text-on-surface-variant">% do Grupo</th>
                              <th className="px-6 md:px-8 py-4 md:py-5 text-[10px] md:text-xs font-black uppercase tracking-widest text-on-surface-variant text-right">Ação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.data.map((item, index) => (
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
                                <td className="px-6 md:px-8 py-4 md:py-6">
                                  {editingLimit?.id === item.id ? (
                                    <input
                                      autoFocus
                                      type="text"
                                      inputMode="decimal"
                                      value={editingLimit.value}
                                      placeholder="R$ 0,00"
                                      onChange={(e) => handleInputChange(item.id, e.target.value)}
                                      onBlur={() => handleBlur(item.id)}
                                      className="bg-surface-container-highest border-2 border-primary rounded-xl px-2 md:px-3 py-1 md:py-1.5 w-32 md:w-40 outline-none font-black text-xs md:text-sm text-on-surface shadow-lg text-right"
                                    />
                                  ) : (
                                    <button 
                                      onClick={() => {
                                        const val = item.limit === 0 ? '' : maskCurrency((item.limit * 100).toFixed(0));
                                        setEditingLimit({ id: item.id, value: val });
                                      }}
                                      className={cn("text-sm md:text-base font-black transition-colors flex items-center gap-2 group/btn", sIdx === 0 ? "text-on-surface hover:text-tertiary" : "text-on-surface hover:text-primary")}
                                    >
                                      {formatCurrency(item.limit)}
                                      <Plus size={14} className="opacity-0 lg:group-hover/btn:opacity-100 transition-opacity" />
                                    </button>
                                  )}
                                </td>
                                <td className="px-6 md:px-8 py-4 md:py-6">
                                  <div className="flex items-center gap-4">
                                    <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden max-w-[120px]">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${item.percentage}%` }}
                                        className={cn("h-full", section.accent)}
                                      />
                                    </div>
                                    <span className="text-[10px] md:text-sm font-black text-on-surface-variant">
                                      {item.percentage.toFixed(1)}%
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 md:px-8 py-4 md:py-6 text-right">
                                  {saving === item.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-primary ml-auto" />
                                  ) : item.limit > 0 ? (
                                    <CheckCircle2 className={cn("w-4 h-4 ml-auto opacity-40", sIdx === 0 ? "text-tertiary" : "text-primary")} />
                                  ) : null}
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!loading && categories.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-on-surface-variant gap-4">
              <AlertCircle size={40} className="opacity-20" />
              <p className="font-medium">Nenhuma categoria encontrada.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
