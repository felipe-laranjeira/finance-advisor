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
  const [isMobile, setIsMobile] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [incomeData, setIncomeData] = useState<any[]>([]);
  const [expenseData, setExpenseData] = useState<any[]>([]);
  const [investmentData, setInvestmentData] = useState<any[]>([]);
  const [evolutionData, setEvolutionData] = useState<any[]>([]);
  const [equityEvolutionData, setEquityEvolutionData] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState<boolean | null>(null);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

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

      // Safety check for Supabase configuration
      const isConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && 
                           process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-project.supabase.co';
      
      if (!isConfigured) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const startDate = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
        const endDate = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];

        // Fetch Income for selected month
        const { data: income, error: incomeErr } = await supabase
          .from('incoming')
          .select('*, incoming_categories(name)')
          .eq('user_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate);
        
        if (incomeErr) throw incomeErr;

        // Fetch Expenses for selected month
        const { data: expenses, error: expensesErr } = await supabase
          .from('transactions')
          .select('*, categories(name, is_investment)')
          .eq('user_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate);

        if (expensesErr) throw expensesErr;

        // Fetch Investments for selected month
        const { data: investments, error: investmentsErr } = await supabase
          .from('investments')
          .select('*')
          .eq('user_id', user.id)
          .eq('reference_date', startDate); 

        if (investmentsErr) throw investmentsErr;

        // Fetch Budgets
        const { data: budgetData, error: budgetErr } = await supabase
          .from('budgets')
          .select('*, categories(name)')
          .eq('user_id', user.id);

        if (budgetErr && budgetErr.code !== '42P01') throw budgetErr;

        // Fetch Monthly Evolution (last 12 months)
        const evolutionPromises = [];
        const equityEvolutionPromises = [];
        
        for (let i = 11; i >= 0; i--) {
          const d = new Date(selectedYear, selectedMonth - i, 1);
          const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
          
          evolutionPromises.push(
            Promise.all([
              supabase.from('incoming').select('amount').eq('user_id', user.id).gte('date', start).lte('date', end),
              supabase.from('transactions').select('amount, categories(is_investment)').eq('user_id', user.id).gte('date', start).lte('date', end)
            ]).then(([inc, exp]) => {
              const incomeSum = inc.data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
              const totalExpSum = Math.abs(exp.data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0);
              const invExpSum = Math.abs(exp.data?.filter(e => e.categories?.is_investment === true).reduce((acc, curr) => acc + Number(curr.amount), 0) || 0);
              const consumptionExpSum = totalExpSum - invExpSum;

              return {
                month: months[d.getMonth()],
                income: incomeSum,
                expense: consumptionExpSum,
                balance: incomeSum - totalExpSum,
                investmentRate: incomeSum > 0 ? (invExpSum / incomeSum) * 100 : 0
              };
            })
          );

          equityEvolutionPromises.push(
            supabase.from('investments')
              .select('balance')
              .eq('user_id', user.id)
              .eq('reference_date', start)
              .then(({ data }) => ({
                month: months[d.getMonth()],
                balance: data?.reduce((acc, curr) => acc + Number(curr.balance), 0) || 0
              }))
          );
        }
        
        const [evolution, equityEvolution] = await Promise.all([
          Promise.all(evolutionPromises),
          Promise.all(equityEvolutionPromises)
        ]);

        setIncomeData(income || []);
        setExpenseData(expenses || []);
        setInvestmentData(investments || []);
        setEvolutionData(evolution);
        setEquityEvolutionData(equityEvolution);
        setBudgets(budgetData || []);
      } catch (err) {
        console.error('Erro ao buscar dados do painel:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, selectedMonth, selectedYear]);

  const stats = useMemo(() => {
    const totalIncome = incomeData.reduce((acc, curr) => acc + Number(curr.amount), 0);
    
    // Separate Investment contributions from Consumption expenses
    const investmentTransactions = expenseData.filter(curr => curr.categories?.is_investment === true);
    const consumptionTransactions = expenseData.filter(curr => curr.categories?.is_investment !== true);

    const totalInvestmentFlow = Math.abs(investmentTransactions.reduce((acc, curr) => acc + Number(curr.amount), 0));
    const totalConsumptionExpense = Math.abs(consumptionTransactions.reduce((acc, curr) => acc + Number(curr.amount), 0));
    const totalExpense = totalInvestmentFlow + totalConsumptionExpense;
    
    const balance = totalIncome - totalExpense;
    const investmentRate = totalIncome > 0 ? (totalInvestmentFlow / totalIncome) * 100 : 0;

    const expenseByCategory = consumptionTransactions.reduce((acc: any, curr) => {
      const catName = curr.categories?.name || 'Outros';
      acc[catName] = (acc[catName] || 0) + Math.abs(Number(curr.amount));
      return acc;
    }, {});

    const pieData = Object.keys(expenseByCategory).map(name => ({
      name,
      value: expenseByCategory[name]
    }));

    const investmentByType = investmentData.reduce((acc: any, curr) => {
      const type = curr.asset_type || 'Outros';
      acc[type] = (acc[type] || 0) + Number(curr.balance);
      return acc;
    }, {});

    const investmentPieData = Object.keys(investmentByType).map(name => ({
      name,
      value: investmentByType[name]
    }));

    const totalEquity = investmentData.reduce((acc, curr) => acc + Number(curr.balance), 0);

    // Budget vs Expenses Comparison
    const budgetAnalysis = budgets.map(b => {
      const catName = b.categories?.name;
      const spent = expenseByCategory[catName] || 0;
      const limit = Number(b.limit_amount);
      const percent = limit > 0 ? (spent / limit) * 100 : 0;
      
      return {
        name: catName,
        spent,
        limit,
        percent,
        status: percent > 100 ? 'over' : percent > 80 ? 'warning' : 'ok'
      };
    }).filter(b => b.limit > 0);

    return {
      totalIncome,
      totalExpense,
      totalInvestmentFlow,
      totalConsumptionExpense,
      investmentRate,
      balance,
      pieData,
      investmentPieData,
      totalEquity,
      isOverspent: totalExpense > totalIncome && totalIncome > 0,
      budgetAnalysis
    };
  }, [incomeData, expenseData, investmentData, budgets]);

  const isSupabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && 
                               process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-project.supabase.co' &&
                               process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
                               process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'placeholder-key';

  if (loading && !incomeData.length && !expenseData.length && isSupabaseConfigured) {
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
      <main className="flex-1 lg:ml-64 flex flex-col">
        <TopBar />
        
        {!isSupabaseConfigured && (
          <div className="mx-8 mt-8 p-4 bg-error-container text-on-error-container rounded-2xl border border-error/20 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center shrink-0">
               <AlertCircle className="text-error" size={20} />
            </div>
            <div>
              <p className="font-bold">Supabase não configurado</p>
              <p className="text-sm opacity-80">Configure as variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY nas configurações para visualizar o painel.</p>
            </div>
          </div>
        )}

        <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto w-full">
          {/* Header with Month Selector */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-black font-headline text-primary tracking-tight">Painel Financeiro</h1>
              <p className="text-sm md:text-base text-on-surface-variant font-medium">Visão geral da sua saúde financeira</p>
            </div>
            
            <div className="flex items-center gap-3 bg-surface-container-low p-2 rounded-2xl border border-outline-variant/10 w-full md:w-auto">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Income Card */}
            <div className="bg-surface-container-lowest p-6 rounded-[2rem] border border-outline-variant/10 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingUp size={60} className="text-secondary" />
              </div>
              <div className="relative z-10 flex justify-between items-end">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-1.5 rounded-lg bg-secondary/10 text-secondary">
                      <ArrowUpRight size={16} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Receitas</span>
                  </div>
                  <h2 className="text-2xl font-black font-headline text-on-surface">
                    {formatCurrency(stats.totalIncome)}
                  </h2>
                </div>
                <div className="h-16 w-32 mb-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={evolutionData}>
                      <Area 
                        type="monotone" 
                        dataKey="income" 
                        stroke="#006b5f" 
                        fill="#006b5f" 
                        fillOpacity={0.1} 
                        strokeWidth={2}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Expense Card */}
            <div className="bg-surface-container-lowest p-6 rounded-[2rem] border border-outline-variant/10 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingDown size={60} className="text-tertiary" />
              </div>
              <div className="relative z-10 flex justify-between items-end">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-1.5 rounded-lg bg-tertiary/10 text-tertiary">
                      <ArrowDownRight size={16} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Consumo</span>
                  </div>
                  <h2 className="text-2xl font-black font-headline text-on-surface">
                    {formatCurrency(stats.totalConsumptionExpense)}
                  </h2>
                </div>
                <div className="h-16 w-32 mb-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={evolutionData}>
                      <Area 
                        type="monotone" 
                        dataKey="expense" 
                        stroke="#68151b" 
                        fill="#68151b" 
                        fillOpacity={0.1} 
                        strokeWidth={2}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Balance Card */}
            <div className={cn(
              "p-6 rounded-[2rem] shadow-xl relative overflow-hidden group",
              stats.balance >= 0 ? "bg-primary shadow-primary/20" : "bg-error shadow-error/20"
            )}>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <DollarSign size={60} className="text-white" />
              </div>
              <div className="relative z-10 text-white flex justify-between items-end">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-1.5 rounded-lg bg-white/10 text-white">
                      <TrendingUp size={16} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Saldo Livre</span>
                  </div>
                  <h2 className="text-2xl font-black font-headline">
                    {formatCurrency(stats.balance)}
                  </h2>
                </div>
                <div className="h-16 w-32 mb-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={evolutionData}>
                      <Area 
                        type="monotone" 
                        dataKey="balance" 
                        stroke="#ffffff" 
                        fill="#ffffff" 
                        fillOpacity={0.2} 
                        strokeWidth={2}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Investment Rate Card */}
            <div className="bg-secondary p-6 rounded-[2rem] shadow-xl shadow-secondary/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={60} className="text-white" />
              </div>
              <div className="relative z-10 text-on-secondary flex justify-between items-end">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-1.5 rounded-lg bg-white/10 text-white">
                      <ArrowUpRight size={16} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Taxa de Aporte</span>
                  </div>
                  <h2 className="text-2xl font-black font-headline mb-1">
                    {stats.investmentRate.toFixed(1)}%
                  </h2>
                  <p className="text-[10px] font-medium opacity-90 truncate">
                    Investiu {formatCurrency(stats.totalInvestmentFlow)}
                  </p>
                </div>
                <div className="h-16 w-32 mb-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={evolutionData}>
                      <Area 
                        type="monotone" 
                        dataKey="investmentRate" 
                        stroke="#ffffff" 
                        fill="#ffffff" 
                        fillOpacity={0.2} 
                        strokeWidth={2}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Monthly Evolution Chart */}
            <div className="bg-surface-container-low p-8 rounded-[2.5rem] border border-outline-variant/10">
              <div className="mb-8">
                <h3 className="text-xl font-black font-headline text-on-surface tracking-tight">Evolução de Fluxo de Caixa</h3>
                <p className="text-sm text-on-surface-variant font-medium">Comparativo de receitas e despesas (últimos 12 meses)</p>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={evolutionData} margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e3e6" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#434652', fontSize: 10, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis 
                      width={80}
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#434652', fontSize: 10, fontWeight: 700 }}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f2f4f7' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => formatCurrency(Number(value))}
                    />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                    <Bar dataKey="income" name="Receita" fill="#006b5f" radius={[6, 6, 0, 0]} barSize={12} />
                    <Bar dataKey="expense" name="Despesa" fill="#68151b" radius={[6, 6, 0, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Equity Evolution Chart */}
            <div className="bg-surface-container-low p-8 rounded-[2.5rem] border border-outline-variant/10">
              <div className="mb-8">
                <h3 className="text-xl font-black font-headline text-on-surface tracking-tight">Evolução Patrimonial</h3>
                <p className="text-sm text-on-surface-variant font-medium">Crescimento do patrimônio total (últimos 12 meses)</p>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={equityEvolutionData} margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e3e6" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#434652', fontSize: 10, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis 
                      width={80}
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#434652', fontSize: 10, fontWeight: 700 }}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f2f4f7' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => formatCurrency(Number(value))}
                    />
                    <Bar dataKey="balance" name="Patrimônio" fill="#003178" radius={[6, 6, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Split Donut Chart */}
            <div className="bg-surface-container-low p-8 rounded-[2.5rem] border border-outline-variant/10">
              <div className="mb-8 text-center md:text-left">
                <h3 className="text-xl font-black font-headline text-on-surface tracking-tight">Despesas por Categoria</h3>
                <p className="text-sm text-on-surface-variant font-medium">Distribuição dos gastos no mês selecionado</p>
              </div>
              <div className="h-auto min-h-[500px] md:h-96 w-full flex flex-col md:flex-row items-center justify-center gap-8">
                <div className="h-64 md:h-full w-full md:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={isMobile ? 45 : 55}
                        outerRadius={isMobile ? 75 : 90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => formatCurrency(Number(value))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/2 space-y-3 max-h-[350px] md:max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {stats.pieData.map((entry, index) => (
                    <div key={entry.name} className="flex flex-col gap-1.5 p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-sm font-bold text-on-surface truncate">{entry.name}</span>
                      </div>
                      <div className="flex items-center justify-between ml-6">
                        <span className="text-xs font-black text-primary font-headline">{formatCurrency(entry.value)}</span>
                        <span className="text-[10px] font-black text-on-surface-variant/40 bg-surface-container-high px-2 py-0.5 rounded-full">
                          {stats.totalExpense > 0 ? ((entry.value / stats.totalExpense) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
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

            {/* Assets Split Donut Chart */}
            <div className="bg-surface-container-low p-8 rounded-[2.5rem] border border-outline-variant/10">
              <div className="mb-8 text-center md:text-left">
                <h3 className="text-xl font-black font-headline text-on-surface tracking-tight">Patrimônio por Ativo</h3>
                <p className="text-sm text-on-surface-variant font-medium">Distribuição dos investimentos no mês selecionado</p>
              </div>
              <div className="h-auto min-h-[500px] md:h-96 w-full flex flex-col md:flex-row items-center justify-center gap-8">
                <div className="h-64 md:h-full w-full md:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.investmentPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={isMobile ? 45 : 55}
                        outerRadius={isMobile ? 75 : 90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.investmentPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => formatCurrency(Number(value))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/2 space-y-3 max-h-[350px] md:max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {stats.investmentPieData.map((entry, index) => (
                    <div key={entry.name} className="flex flex-col gap-1.5 p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[(index + 2) % COLORS.length] }} />
                        <span className="text-sm font-bold text-on-surface truncate">{entry.name}</span>
                      </div>
                      <div className="flex items-center justify-between ml-6">
                        <span className="text-xs font-black text-secondary font-headline">{formatCurrency(entry.value)}</span>
                        <span className="text-[10px] font-black text-on-surface-variant/40 bg-surface-container-high px-2 py-0.5 rounded-full">
                          {stats.totalEquity > 0 ? ((entry.value / stats.totalEquity) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {stats.investmentPieData.length === 0 && (
                    <div className="text-center py-8 text-on-surface-variant opacity-50 font-medium">
                      Nenhum investimento registrado
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Budget Analysis Table & Chart */}
          {hasData && stats.budgetAnalysis.length > 0 && (
            <div className="bg-surface-container-low p-8 rounded-[2.5rem] border border-outline-variant/10">
              <div className="mb-8">
                <h3 className="text-xl font-black font-headline text-on-surface tracking-tight">Despesas vs Orçamento</h3>
                <p className="text-sm text-on-surface-variant font-medium">Acompanhamento do limite de gastos por categoria no mês de {months[selectedMonth]}</p>
              </div>
              
              <div className={cn(
                "w-full mb-8",
                isMobile ? "h-[500px]" : "h-80"
              )}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.budgetAnalysis} layout="vertical" margin={{ left: isMobile ? 0 : 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e0e3e6" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#434652', fontSize: 10, fontWeight: 700 }}
                      width={100}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f2f4f7' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any, name: any) => [formatCurrency(Number(value)), name === 'spent' ? 'Gasto' : 'Limite']}
                    />
                    <Bar dataKey="limit" name="Limite" fill="#e0e3e6" radius={[0, 4, 4, 0]} barSize={20} />
                    <Bar dataKey="spent" name="Gasto" radius={[0, 4, 4, 0]} barSize={20}>
                      {stats.budgetAnalysis.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.percent > 100 ? '#68151b' : entry.percent > 80 ? '#f9a825' : '#006b5f'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Budget Alerts */}
              <div className="space-y-4">
                {stats.budgetAnalysis.map((item) => {
                  if (item.status === 'ok') return null;
                  
                  return (
                    <motion.div 
                      key={item.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "p-6 rounded-2xl flex items-center gap-4 border shadow-sm",
                        item.status === 'over' 
                          ? "bg-error-container text-on-error-container border-error/20" 
                          : "bg-warning-container text-on-warning-container border-warning/20"
                      )}
                      style={item.status === 'warning' ? { backgroundColor: '#fff9c4', color: '#f57f17', borderColor: 'rgba(245, 127, 23, 0.2)' } : {}}
                    >
                      <AlertCircle size={24} className={item.status === 'over' ? "text-error" : "text-amber-600"} />
                      <div className="flex-1">
                        <p className="font-bold text-sm">
                          {item.status === 'over' 
                            ? `Você ultrapassou o limite estabelecido para a categoria ${item.name}!` 
                            : `Você está chegando perto do limite estabelecido para a categoria ${item.name}!`}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex-1 h-2 bg-black/5 rounded-full overflow-hidden">
                            <div 
                              className={cn("h-full", item.status === 'over' ? "bg-error" : "bg-amber-600")} 
                              style={{ width: `${Math.min(item.percent, 100)}%` }} 
                            />
                          </div>
                          <span className="text-xs font-black uppercase tracking-widest whitespace-nowrap">
                            {item.percent.toFixed(1)}% utilizado
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  </main>
</div>
  );
}
