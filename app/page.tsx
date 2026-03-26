'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { Stats } from '@/components/Stats';
import { TransactionTable } from '@/components/TransactionTable';
import { InsightCard } from '@/components/InsightCard';
import { TransactionModal } from '@/components/TransactionModal';
import { Filter, Download, Calendar, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Transaction {
  id: string;
  date: Date;
  description: string;
  subtext: string;
  category: string;
  status: string;
  amount: number;
}

export default function Page() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas as Categorias');
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('Todos');

  const fetchAvailableMonths = useCallback(async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('date')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching months:', error);
      return;
    }

    if (data) {
      const months = new Set<string>();
      const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];

      data.forEach((t: any) => {
        const date = new Date(t.date);
        // Use UTC to avoid timezone shifts for dates stored as YYYY-MM-DD
        const monthYear = `${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
        months.add(monthYear);
      });

      setAvailableMonths(Array.from(months));
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    
    let selectString = `
      *,
      categories (
        name
      )
    `;

    if (selectedCategory !== 'Todas as Categorias') {
      selectString = `
        *,
        categories!inner (
          name
        )
      `;
    }

    let query = supabase
      .from('transactions')
      .select(selectString);

    if (selectedCategory !== 'Todas as Categorias') {
      query = query.eq('categories.name', selectedCategory);
    }

    if (selectedMonthYear !== 'Todos') {
      const [monthName, year] = selectedMonthYear.split(' ');
      const monthMap: { [key: string]: number } = {
        'Janeiro': 0, 'Fevereiro': 1, 'Março': 2, 'Abril': 3, 'Maio': 4, 'Junho': 5,
        'Julho': 6, 'Agosto': 7, 'Setembro': 8, 'Outubro': 9, 'Novembro': 10, 'Dezembro': 11
      };
      const month = monthMap[monthName];
      if (month !== undefined) {
        const startDate = new Date(parseInt(year), month, 1);
        const endDate = new Date(parseInt(year), month + 1, 0);
        query = query.gte('date', startDate.toISOString().split('T')[0])
                     .lte('date', endDate.toISOString().split('T')[0]);
      }
    }

    const { data, error } = await query.order('date', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
    } else {
      const formatted = data.map((t: any) => ({
        id: t.id,
        date: new Date(t.date),
        description: t.description,
        subtext: '', // Status and subtext were removed from UI but kept in interface for now
        category: t.categories?.name || 'Outros',
        status: 'Pago',
        amount: parseFloat(t.amount),
      }));
      setTransactions(formatted);
    }
    setLoading(false);
  }, [selectedCategory, selectedMonthYear]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('name')
        .order('name');
      
      if (mounted) {
        if (catError) {
          console.error('Error fetching categories:', catError);
        } else if (catData) {
          setCategories(catData.map(c => c.name));
        }
        await fetchAvailableMonths();
      }
    };
    load();
    return () => { mounted = false; };
  }, [fetchAvailableMonths]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (mounted) {
        await fetchTransactions();
      }
    };
    load();
    return () => { mounted = false; };
  }, [selectedCategory, selectedMonthYear, fetchTransactions]);

  // Expose modal open function to window for Sidebar access
  useEffect(() => {
    (window as any).openTransactionModal = () => {
      setEditingTransaction(null);
      setIsModalOpen(true);
    };
  }, []);

  const totals = useMemo(() => {
    const total = Math.abs(transactions.reduce((acc, t) => acc + t.amount, 0));
    const fixed = Math.abs(transactions.filter(t => t.category === 'Aluguel').reduce((acc, t) => acc + t.amount, 0));
    const variable = total - fixed;
    return { total, fixed, variable };
  }, [transactions]);

  const handleSaveTransaction = async (data: any) => {
    // Find category ID
    const { data: catData } = await supabase
      .from('categories')
      .select('id')
      .eq('name', data.category)
      .single();

    const payload = {
      description: data.description,
      amount: data.amount,
      date: data.date.toISOString().split('T')[0],
      category_id: catData?.id,
    };

    if (data.id) {
      const { error } = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', data.id);
      if (error) console.error('Error updating:', error);
    } else {
      const { error } = await supabase
        .from('transactions')
        .insert([payload]);
      if (error) console.error('Error inserting:', error);
    }
    fetchAvailableMonths();
    fetchTransactions();
  };

  const handleDeleteTransaction = async (id: string) => {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting:', error);
    } else {
      setTransactions(prev => prev.filter(t => t.id !== id));
      fetchAvailableMonths();
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  };

  const isSupabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <main className="flex-1 ml-64 bg-surface min-h-screen pb-20">
        <TopBar />
        
        {!isSupabaseConfigured && (
          <div className="mx-12 mt-8 p-4 bg-error-container text-on-error-container rounded-2xl border border-error/20 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center shrink-0">
              <Tag className="text-error" size={20} />
            </div>
            <div>
              <p className="font-bold">Supabase não configurado</p>
              <p className="text-sm opacity-80">Por favor, configure as variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY nas configurações do projeto.</p>
            </div>
          </div>
        )}

        <div className="p-12 max-w-7xl mx-auto">
          {/* Hero Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
            <div>
              <h2 className="text-5xl font-black text-on-surface font-headline tracking-tight mb-3">Despesas</h2>
              <p className="text-on-surface-variant text-lg font-medium">Acompanhamento abrangente de suas saídas fiscais e compromissos.</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex bg-surface-container-high p-1.5 rounded-2xl shadow-inner">
                <button className="px-6 py-2.5 rounded-xl bg-surface-container-lowest shadow-md text-sm font-bold text-primary transition-all">Vista em Tabela</button>
                <button className="px-6 py-2.5 rounded-xl text-sm font-bold text-on-surface-variant hover:text-on-surface transition-all">Insights</button>
              </div>
              <button className="px-8 py-3.5 rounded-2xl bg-surface-container-lowest text-on-surface font-bold flex items-center gap-2.5 border border-outline-variant/10 hover:bg-surface-container-low transition-all shadow-sm">
                <Filter size={18} />
                Filtros
              </button>
            </div>
          </div>

          <Stats 
            total={totals.total} 
            fixed={totals.fixed} 
            variable={totals.variable} 
          />

          {/* Filters & Controls */}
          <div className="flex flex-wrap items-center gap-5 mb-8 px-2">
            <div className="flex items-center gap-3 px-6 py-3 bg-surface-container-low rounded-full text-sm font-bold text-on-surface-variant border border-outline-variant/5">
              <Calendar size={18} className="text-primary" />
              <select 
                value={selectedMonthYear}
                onChange={(e) => setSelectedMonthYear(e.target.value)}
                className="bg-transparent border-none focus:ring-0 p-0 text-sm font-bold cursor-pointer"
              >
                <option value="Todos">Todos os Meses</option>
                {availableMonths.map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-3 px-6 py-3 bg-surface-container-low rounded-full text-sm font-bold text-on-surface-variant border border-outline-variant/5">
              <Tag size={18} className="text-primary" />
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent border-none focus:ring-0 p-0 text-sm font-bold cursor-pointer"
              >
                <option value="Todas as Categorias">Todas as Categorias</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            <button className="ml-auto flex items-center gap-2.5 text-primary font-black text-sm hover:underline transition-all group">
              <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
              Exportar PDF
            </button>
          </div>

          <TransactionTable 
            transactions={transactions} 
            onDelete={handleDeleteTransaction}
            onEdit={handleEditTransaction}
          />

          <InsightCard />
        </div>
      </main>

      <TransactionModal 
        key={isModalOpen ? (editingTransaction?.id || 'new') : 'closed'}
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveTransaction}
        editingTransaction={editingTransaction}
      />
    </div>
  );
}
