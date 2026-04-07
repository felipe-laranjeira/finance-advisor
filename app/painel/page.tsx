'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area,
  Legend
} from 'recharts';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

const COLORS = ['#003178', '#006b5f', '#68151b', '#872c2f', '#0d47a1', '#70d8c8'];

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [incomeData, setIncomeData] = useState<any[]>([]);
  const [expenseData, setExpenseData] = useState<any[]>([]);
  const [evolutionData, setEvolutionData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState<boolean | null>(null);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, []);

  // Set initial month based on most recent data
  useEffect(() => {
    const setInitialMonth = async () => {
      if (!user) return;
      
      const [latestInc, latestExp] = await Promise.all([
        supabase.from('incoming').select('date').eq('user_id', user.id).order('date', { ascending: false }).limit(1),
        supabase.from('transactions').select('date').eq('user_id', user.id).order('date', { ascending: false }).limit(1)
      ]);

      const hasAnyData = (latestInc.data && latestInc.data.length > 0) || (latestExp.data && latestExp.data.length > 0);
      setHasData(hasAnyData);

      if (hasAnyData) {
        let latestDate: Date | null = null;
        if (latestInc.data?.[0]?.date) latestDate = new Date(latestInc.data[0].date);
        if (latestExp.data?.[0]?.date) {
          const expDate = new Date(latestExp.data[0].date);
          // Use UTC to avoid timezone shifts
          if (!latestDate || expDate > latestDate) latestDate = expDate;
        }

        if (latestDate) {
          const now = new Date();
          const currentMonth = now.getUTCMonth();
          const currentYear = now.getUTCFullYear();
          
          // Check if current month has data (we'd need another query or just check if latestDate is current month)
          // To be simple and follow the rule: if latest data is older than current month, use latest.
          // If latest data is current month or newer, use current month.
          
          const latestMonth = latestDate.getUTCMonth();
          const latestYear = latestDate.getUTCFullYear();

          // If there's data for the current month or future, show current month
          // Otherwise show the most recent month with data
          if (latestYear > currentYear || (latestYear === currentYear && latestMonth >= currentMonth)) {
            setSelectedMonth(currentMonth);
            setSelectedYear(currentYear);
          } else {
            setSelectedMonth(latestMonth);
            setSelectedYear(latestYear);
          }
        }
      }
    };
    setInitialMonth();
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);

      const startDate = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
      const endDate = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];

      // Fetch Income for selected month
      const { data: income } = await supabase
        .from('incoming')
        .select('*, incoming_categories(name)')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      // Fetch Expenses for selected month
      const { data: expenses } = await supabase
        .from('transactions')
        .select('*, categories(name)')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      // Fetch Monthly Evolution (last 6 months)
      const evolutionPromises = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(selectedYear, selectedMonth - i, 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
        
        evolutionPromises.push(
          Promise.all([
            supabase.from('incoming').select('amount').eq('user_id', user.id).gte('date', start).lte('date', end),
            supabase.from('transactions').select('amount').eq('user_id', user.id).gte('date', start).lte('date', end)
          ]).then(([inc, exp]) => ({
            month: months[d.getMonth()],
            income: inc.data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0,
            expense: Math.abs(exp.data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0)
          }))
        );
      }
      const evolution = await Promise.all(evolutionPromises);

      setIncomeData(income || []);
      setExpenseData(expenses || []);
      setEvolutionData(evolution);
      setLoading(false);
    };

    fetchData();
  }, [user, selectedMonth, selectedYear]);

  const stats = useMemo(() => {
    const totalIncome = incomeData.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const totalExpense = Math.abs(expenseData.reduce((acc, curr) => acc + Number(curr.amount), 0));
    const balance = totalIncome - totalExpense;

    const expenseByCategory = expenseData.reduce((acc: any, curr) => {
      const catName = curr.categories?.name || 'Outros';
      acc[catName] = (acc[catName] || 0) + Math.abs(Number(curr.amount));
      return acc;
    }, {});

    const pieData = Object.keys(expenseByCategory).map(name => ({
      name,
      value: expenseByCategory[name]
    }));

    return {
      totalIncome,
      totalExpense,
      balance,
      pieData,
      isOverspent: totalExpense > totalIncome && totalIncome > 0
    };
  }, [incomeData, expenseData]);

  if (loading && !incomeData.length && !expenseData.length) {
    return (
      <div className="flex h-screen bg-surface">
        <Sidebar />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface font-body text-on-surface">
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col">
        <TopBar />
        
        <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
          {/* Header with Month Selector */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-black font-headline text-primary tracking-tight">Painel Financeiro</h1>
              <p className="text-on-surface-variant font-medium">Visão geral da sua saúde financeira</p>
            </div>
            
            <div className="flex items-center gap-3 bg-surface-container-low p-2 rounded-2xl border border-outline-variant/10">
              <Calendar size={18} className="text-on-surface-variant ml-2" />
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer"
              >
                {months.map((month, idx) => (
                  <option key={month} value={idx}>{month}</option>
                ))}
              </select>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer"
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
          
          {hasData === false && !loading && (
            <div className="flex flex-col items-center justify-center py-20 bg-surface-container-low rounded-[2.5rem] border border-dashed border-outline-variant/30">
              <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center mb-6">
                <DollarSign size={40} className="text-on-surface-variant/30" />
              </div>
              <h3 className="text-2xl font-black font-headline text-on-surface mb-2">Você ainda não possui lançamentos</h3>
              <p className="text-on-surface-variant font-medium max-w-md text-center">
                Comece adicionando suas receitas e despesas para visualizar seu painel financeiro completo.
              </p>
            </div>
          )}

          {hasData !== false && (
            <>
              {/* Overspent Alert */}
              {stats.isOverspent && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-error-container text-on-error-container p-4 rounded-2xl flex items-center gap-4 border border-error/20 shadow-lg shadow-error/5"
            >
              <div className="bg-error text-white p-2 rounded-xl">
                <AlertCircle size={24} />
              </div>
              <div>
                <p className="font-black font-headline">Atenção!</p>
                <p className="text-sm font-medium opacity-90">Você gastou mais do que recebeu esse mês. Revise suas despesas.</p>
              </div>
            </motion.div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Income Card */}
            <div className="bg-surface-container-lowest p-8 rounded-[2.5rem] border border-outline-variant/10 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingUp size={80} className="text-secondary" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-secondary/10 text-secondary">
                    <ArrowUpRight size={20} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Total de Receitas</span>
                </div>
                <h2 className="text-4xl font-black font-headline text-on-surface mb-4">
                  {formatCurrency(stats.totalIncome)}
                </h2>
                <div className="h-16 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={evolutionData}>
                      <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#006b5f" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#006b5f" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="income" stroke="#006b5f" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Expense Card */}
            <div className="bg-surface-container-lowest p-8 rounded-[2.5rem] border border-outline-variant/10 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingDown size={80} className="text-tertiary" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-tertiary/10 text-tertiary">
                    <ArrowDownRight size={20} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Total de Despesas</span>
                </div>
                <h2 className="text-4xl font-black font-headline text-on-surface mb-4">
                  {formatCurrency(stats.totalExpense)}
                </h2>
                <div className="h-16 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={evolutionData}>
                      <defs>
                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#68151b" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#68151b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="expense" stroke="#68151b" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Balance Card */}
            <div className="bg-primary p-8 rounded-[2.5rem] shadow-xl shadow-primary/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <DollarSign size={80} className="text-white" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-white/10 text-white">
                    <TrendingUp size={20} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-primary-fixed/60">Saldo do Mês</span>
                </div>
                <h2 className="text-4xl font-black font-headline text-white mb-2">
                  {formatCurrency(stats.balance)}
                </h2>
                <p className="text-primary-fixed/80 text-sm font-medium">
                  {stats.balance >= 0 ? 'Você está no azul!' : 'Atenção ao orçamento.'}
                </p>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Monthly Evolution Chart */}
            <div className="bg-surface-container-low p-8 rounded-[2.5rem] border border-outline-variant/10">
              <div className="mb-8">
                <h3 className="text-xl font-black font-headline text-on-surface tracking-tight">Evolução Mensal</h3>
                <p className="text-sm text-on-surface-variant font-medium">Comparativo de receitas e despesas (últimos 6 meses)</p>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e3e6" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#434652', fontSize: 12, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#434652', fontSize: 12, fontWeight: 700 }}
                      tickFormatter={(value) => `R$ ${value}`}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f2f4f7' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                    <Bar dataKey="income" name="Receita" fill="#006b5f" radius={[6, 6, 0, 0]} barSize={20} />
                    <Bar dataKey="expense" name="Despesa" fill="#68151b" radius={[6, 6, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Split Donut Chart */}
            <div className="bg-surface-container-low p-8 rounded-[2.5rem] border border-outline-variant/10">
              <div className="mb-8">
                <h3 className="text-xl font-black font-headline text-on-surface tracking-tight">Despesas por Categoria</h3>
                <p className="text-sm text-on-surface-variant font-medium">Distribuição dos gastos no mês selecionado</p>
              </div>
              <div className="h-80 w-full flex flex-col md:flex-row items-center justify-center gap-8">
                <div className="h-full w-full md:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/2 space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {stats.pieData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/5">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-sm font-bold text-on-surface">{entry.name}</span>
                      </div>
                      <span className="text-sm font-black text-on-surface-variant">{formatCurrency(entry.value)}</span>
                    </div>
                  ))}
                  {stats.pieData.length === 0 && (
                    <div className="text-center py-8 text-on-surface-variant opacity-50 font-medium">
                      Nenhuma despesa registrada
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  </main>
</div>
  );
}
