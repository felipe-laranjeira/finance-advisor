'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { useLayout } from '@/components/LayoutProvider';
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
import { MaskedValue } from '@/components/MaskedValue';
import { useMask } from '@/components/MaskProvider';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  CheckCircle2
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

const COLORS = ['#003178', '#006b5f', '#68151b', '#872c2f', '#0d47a1', '#70d8c8'];

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { isSidebarOpen } = useLayout();
  const { isMasked } = useMask();
  const [isMobile, setIsMobile] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [incomeData, setIncomeData] = useState<any[]>([]);
  const [expenseData, setExpenseData] = useState<any[]>([]);
  const [investmentFlows, setInvestmentFlows] = useState<any[]>([]);
  const [investmentAssets, setInvestmentAssets] = useState<any[]>([]);
  const [evolutionData, setEvolutionData] = useState<any[]>([]);
  const [equityEvolutionData, setEquityEvolutionData] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [invBudgets, setInvBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      
      const isConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && 
                           process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-project.supabase.co';
      
      if (!isConfigured) return;

      try {
        const [latestInc, latestExp, latestInv] = await Promise.all([
          supabase.from('incoming').select('date').eq('user_id', user.id).order('date', { ascending: false }).limit(1),
          supabase.from('expense_transactions').select('date').eq('user_id', user.id).order('date', { ascending: false }).limit(1),
          supabase.from('investments').select('reference_date').eq('user_id', user.id).order('reference_date', { ascending: false }).limit(1)
        ]);

        const hasAnyData = (latestInc.data && latestInc.data.length > 0) || 
                          (latestExp.data && latestExp.data.length > 0) ||
                          (latestInv.data && latestInv.data.length > 0);
        setHasData(hasAnyData);

        if (hasAnyData) {
          let dates: Date[] = [];
          if (latestInc.data?.[0]?.date) dates.push(new Date(latestInc.data[0].date));
          if (latestExp.data?.[0]?.date) dates.push(new Date(latestExp.data[0].date));
          if (latestInv.data?.[0]?.reference_date) dates.push(new Date(latestInv.data[0].reference_date));

          let latestDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;

          if (latestDate) {
            const now = new Date();
            const currentMonth = now.getUTCMonth();
            const currentYear = now.getUTCFullYear();
            
            const latestMonth = latestDate.getUTCMonth();
            const latestYear = latestDate.getUTCFullYear();

            if (latestYear > currentYear || (latestYear === currentYear && latestMonth >= currentMonth)) {
              setSelectedMonth(currentMonth);
              setSelectedYear(currentYear);
            } else {
              setSelectedMonth(latestMonth);
              setSelectedYear(latestYear);
            }
          }
        }
      } catch (err) {
        console.error('Erro ao definir mês inicial:', err);
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
      setError(null);

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
          .from('expense_transactions')
          .select('*, transactions_categories(name)')
          .eq('user_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate);

        if (expensesErr) throw expensesErr;

        // Fetch Investment Assets for selected month
        const { data: invAssets, error: invAssetsErr } = await supabase
          .from('investments')
          .select('*')
          .eq('user_id', user.id)
          .eq('reference_date', startDate); 

        if (invAssetsErr) throw invAssetsErr;
        setInvestmentAssets(invAssets || []);
        setInvestmentFlows([]); // No longer using investment_transactions
        // Fetch Budgets
        const [{ data: budgetData }, { data: invBudgetData }] = await Promise.all([
          supabase.from('expense_budgets').select('*, transactions_categories(name)').eq('user_id', user.id),
          supabase.from('investment_budgets').select('*, investiments_categories(name)').eq('user_id', user.id)
        ]);

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
              supabase.from('expense_transactions').select('amount, transactions_categories(name)').eq('user_id', user.id).gte('date', start).lte('date', end),
            ]).then(([inc, exp]) => {
              const incomeSum = inc.data?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
              
              let totalExpTableFlow = 0;
              let expInvSum = 0;
              exp.data?.forEach(item => {
                const amt = Math.abs(Number(item.amount));
                totalExpTableFlow += amt;
                const cat = item.transactions_categories;
                const catName = Array.isArray(cat) ? cat[0]?.name : (cat as any)?.name;
                if (catName === 'Investimentos') {
                  expInvSum += amt;
                }
              });

              // We no longer fetch from investment_transactions. 
              // Aporte is derived from expenses categorized as "Investimentos".
              const invTableSum = 0;
              
              const consumptionSum = totalExpTableFlow - expInvSum;
              const totalInvestedSum = expInvSum;

              return {
                month: months[d.getUTCMonth()],
                income: incomeSum,
                expense: totalExpTableFlow,
                balance: incomeSum - totalExpTableFlow,
                investmentRate: incomeSum > 0 ? (totalInvestedSum / incomeSum) * 100 : 0
              };
            })
          );

          equityEvolutionPromises.push(
            supabase.from('investments')
              .select('balance')
              .eq('user_id', user.id)
              .eq('reference_date', start)
              .then(({ data }) => ({
                month: months[d.getUTCMonth()],
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
        setEvolutionData(evolution);
        setEquityEvolutionData(equityEvolution);
        setBudgets(budgetData || []);
        setInvBudgets(invBudgetData || []);
      } catch (err: any) {
        console.error('Erro ao buscar dados do painel:', err);
        if (err.message === 'Failed to fetch') {
          setError('Não foi possível conectar ao banco de dados. Verifique suas configurações e conexão.');
        } else {
          setError('Ocorreu um erro ao carregar os dados. Tente novamente mais tarde.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, selectedMonth, selectedYear]);

  const stats = useMemo(() => {
    // Regra 1: Soma das receitas
    const totalIncome = incomeData.reduce((acc, curr) => acc + Number(curr.amount), 0);
    
    // Regra 2 & 4: Segregar despesas de investimento
    const totalExpFromTable = expenseData.reduce((acc, curr) => acc + Math.abs(Number(curr.amount)), 0);
    const expenseInvestments = expenseData
      .filter(curr => {
        const cat = curr.transactions_categories;
        const catName = Array.isArray(cat) ? cat[0]?.name : (cat as any)?.name;
        return catName === 'Investimentos';
      })
      .reduce((acc, curr) => acc + Math.abs(Number(curr.amount)), 0);
    
    const investmentFlowFromTable = Math.abs(investmentFlows.reduce((acc, curr) => acc + Number(curr.amount), 0));
    
    const totalConsumptionExpense = totalExpFromTable - expenseInvestments;
    const totalInvested = investmentFlowFromTable + expenseInvestments;
    
    // Regra 3: Saldo Livre
    const totalExpense = totalExpFromTable + investmentFlowFromTable;
    const balance = totalIncome - totalExpense;
    
    // Regra 4: Taxa de Aporte
    const investmentRate = totalIncome > 0 ? (totalInvested / totalIncome) * 100 : 0;

    const expenseByCategory = expenseData.reduce((acc: any, curr) => {
      const cat = curr.transactions_categories;
      const catName = (Array.isArray(cat) ? cat[0]?.name : (cat as any)?.name) || 'Outros';
      acc[catName] = (acc[catName] || 0) + Math.abs(Number(curr.amount));
      return acc;
    }, {});

    const pieData = Object.keys(expenseByCategory).map(name => ({
      name,
      value: expenseByCategory[name]
    }));

    const investmentByType = investmentAssets.reduce((acc: any, curr) => {
      const type = curr.asset_type || 'Outros';
      acc[type] = (acc[type] || 0) + Number(curr.balance);
      return acc;
    }, {});

    const investmentPieData = Object.keys(investmentByType).map(name => ({
      name,
      value: investmentByType[name]
    }));

    const totalEquity = investmentAssets.reduce((acc, curr) => acc + Number(curr.balance), 0);

    // Budget vs Expenses Comparison
    const budgetAnalysis = budgets.map(b => {
      const catName = b.transactions_categories?.name;
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

    // Investment Goal Analysis
    const investmentBudgetEntry = invBudgets.find(b => 
      b.investiments_categories?.name === 'Investimentos'
    );
    const investmentGoal = investmentBudgetEntry ? Number(investmentBudgetEntry.limit_amount) : 0;
    const invPercent = investmentGoal > 0 ? (totalInvested / investmentGoal) * 100 : 0;
    const invRemainingPercent = Math.max(0, 100 - invPercent);

    return {
      totalIncome,
      totalExpense,
      totalInvested,
      totalConsumptionExpense,
      investmentRate,
      balance,
      pieData,
      investmentPieData,
      totalEquity,
      isOverspent: totalExpense > totalIncome && totalIncome > 0,
      budgetAnalysis,
      investmentGoal,
      invPercent,
      invRemainingPercent
    };
  }, [incomeData, expenseData, investmentFlows, investmentAssets, budgets, invBudgets]);

  const isSupabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && 
                               process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-project.supabase.co' &&
                               process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
                               process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'placeholder-key';

  if (loading && !incomeData.length && !expenseData.length && isSupabaseConfigured) {
    return (
      <div className="flex h-screen bg-surface">
        <Sidebar />
        <main className={cn(
          "flex-1 flex items-center justify-center transition-all duration-300",
          isSidebarOpen ? "md:ml-80" : "md:ml-0"
        )}>
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface font-body text-on-surface">
      <Sidebar />
      <main className={cn(
        "flex-1 flex flex-col transition-all duration-300",
        isSidebarOpen ? "md:ml-80" : "md:ml-0"
      )}>
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
          
          {error && (
            <div className="p-6 bg-error-container text-on-error-container rounded-3xl border border-error/20 flex flex-col md:flex-row items-center gap-6 shadow-xl shadow-error/5">
              <div className="w-16 h-16 bg-error text-white rounded-2xl flex items-center justify-center shrink-0">
                <AlertCircle size={32} />
              </div>
              <div className="text-center md:text-left flex-1">
                <h3 className="text-xl font-black font-headline mb-1">Ops! Algo deu errado</h3>
                <p className="font-medium opacity-90">{error}</p>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="px-8 py-3 bg-error text-white font-bold rounded-xl hover:scale-95 transition-all shadow-lg shadow-error/20"
              >
                Tentar Novamente
              </button>
            </div>
          )}

          {hasData === false && !loading && !error && (
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
                    <MaskedValue value={stats.totalIncome} />
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
                    <MaskedValue value={stats.totalConsumptionExpense} />
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
                    <MaskedValue value={stats.balance} />
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
                    Investiu <MaskedValue value={stats.totalInvested} />
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
                      tickFormatter={(value) => isMasked ? '••••' : formatCurrency(value)}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f2f4f7' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => isMasked ? '••••' : formatCurrency(Number(value))}
                    />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                    <Bar dataKey="income" name="Entradas" fill="#006b5f" radius={[6, 6, 0, 0]} barSize={12} />
                    <Bar dataKey="expense" name="Saídas" fill="#68151b" radius={[6, 6, 0, 0]} barSize={12} />
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
                      tickFormatter={(value) => isMasked ? '••••' : formatCurrency(value)}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f2f4f7' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => isMasked ? '••••' : formatCurrency(Number(value))}
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
                        formatter={(value: any) => isMasked ? '••••' : formatCurrency(Number(value))}
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
                        <span className="text-xs font-black text-primary font-headline"><MaskedValue value={entry.value} /></span>
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
                        formatter={(value: any) => isMasked ? '••••' : formatCurrency(Number(value))}
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
                        <span className="text-xs font-black text-secondary font-headline"><MaskedValue value={entry.value} /></span>
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

          {/* Investment Goals */}
          {hasData && stats.investmentGoal > 0 && (
            <div className="bg-surface-container-low p-8 rounded-[2.5rem] border border-outline-variant/10">
              <div className="mb-8">
                <h3 className="text-xl font-black font-headline text-primary tracking-tight">Metas de Investimento</h3>
                <p className="text-sm text-on-surface-variant font-medium">Acompanhamento do seu aporte mensal em {months[selectedMonth]}</p>
              </div>
              
              <div className={cn(
                "w-full mb-8",
                "h-40"
              )}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={[{
                      name: 'Investimentos',
                      investido: stats.totalInvested,
                      meta: stats.investmentGoal,
                      percent: stats.invPercent
                    }]} 
                    layout="vertical" 
                  >
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
                      formatter={(value: any, name: any) => [isMasked ? '••••' : formatCurrency(Number(value)), name]}
                    />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    />
                    <Bar dataKey="meta" name="Meta" fill="#e0e3e6" radius={[0, 4, 4, 0]} barSize={40} />
                    <Bar dataKey="investido" name="Investido" radius={[0, 4, 4, 0]} barSize={40}>
                      <Cell 
                        fill={stats.invPercent >= 100 ? '#006b5f' : stats.invPercent >= 80 ? '#f9a825' : '#003178'} 
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Investment Alert Message */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "p-6 rounded-2xl flex items-center gap-4 border shadow-sm",
                  stats.invPercent >= 100 
                    ? "bg-secondary/10 text-on-secondary-container border-secondary/20" 
                    : stats.invPercent >= 80 
                      ? "bg-warning-container text-on-warning-container border-warning/20" 
                      : "bg-surface-container-high text-on-surface-variant border-outline-variant/10"
                )}
                style={stats.invPercent >= 80 && stats.invPercent < 100 ? { backgroundColor: '#fff9c4', color: '#f57f17', borderColor: 'rgba(245, 127, 23, 0.2)' } : {}}
              >
                <div className={cn(
                  "p-2 rounded-xl",
                  stats.invPercent >= 100 ? "bg-secondary text-white" : "bg-primary/10 text-primary"
                )}>
                  {stats.invPercent >= 100 ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm">
                    {stats.invPercent < 80 
                      ? `Não esqueça da sua meta de investimento, ainda faltam ${stats.invRemainingPercent.toFixed(1)}%` 
                      : stats.invPercent < 100 
                        ? "Falta pouco, você consegue!" 
                        : "Parabéns! Você superou a sua meta de investimento para esse mês"}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex-1 h-2 bg-black/5 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full", stats.invPercent >= 100 ? "bg-secondary" : stats.invPercent >= 80 ? "bg-amber-600" : "bg-primary")} 
                        style={{ width: `${Math.min(stats.invPercent, 100)}%` }} 
                      />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest whitespace-nowrap">
                      {stats.invPercent.toFixed(1)}% atingido
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

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
                      formatter={(value: any, name: any) => [isMasked ? '••••' : formatCurrency(Number(value)), name]}
                    />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    />
                    <Bar dataKey="limit" name="Orçado" fill="#e0e3e6" radius={[0, 4, 4, 0]} barSize={20} />
                    <Bar dataKey="spent" name="Realizado" radius={[0, 4, 4, 0]} barSize={20}>
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
