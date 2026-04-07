'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { Stats } from '@/components/Stats';
import { TransactionTable } from '@/components/TransactionTable';
import { InsightCard } from '@/components/InsightCard';
import { TransactionModal } from '@/components/TransactionModal';
import { Filter, Download, Calendar, Tag, Upload, Loader2, Sparkles, Receipt, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { GoogleGenAI, Type } from "@google/genai";
import { cn, formatCurrency } from '@/lib/utils';

interface Transaction {
  id: string;
  date: Date;
  description: string;
  subtext: string;
  category: string;
  status: string;
  amount: number;
}

import { useAuth } from '@/components/AuthProvider';

export default function Page() {
  const { user, loading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas as Categorias');
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('Todos');
  const [isImporting, setIsImporting] = useState(false);
  const [comparisonStats, setComparisonStats] = useState({ current: 0, previous: 0 });
  const [activeTab, setActiveTab] = useState<'table' | 'insights'>('table');
  const [subscriptionInsights, setSubscriptionInsights] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [budgetReview, setBudgetReview] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const router = useRouter();

  const fetchAvailableMonths = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('transactions')
      .select('date')
      .eq('user_id', user!.id)
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

      const monthsArray = Array.from(months);
      setAvailableMonths(monthsArray);

      // Default selection logic: current month if exists, otherwise most recent month
      if (selectedMonthYear === 'Todos' && monthsArray.length > 0) {
        const now = new Date();
        const currentMonthYear = `${monthNames[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
        
        if (months.has(currentMonthYear)) {
          setSelectedMonthYear(currentMonthYear);
        } else {
          setSelectedMonthYear(monthsArray[0]);
        }
      }
    }
  }, [user, selectedMonthYear]);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const startOfCurrent = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
    const endOfCurrent = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
    
    const startOfPrevious = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
    const endOfPrevious = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

    const [currentRes, previousRes] = await Promise.all([
      supabase.from('transactions').select('amount').eq('user_id', user!.id).gte('date', startOfCurrent).lte('date', endOfCurrent),
      supabase.from('transactions').select('amount').eq('user_id', user!.id).gte('date', startOfPrevious).lte('date', endOfPrevious)
    ]);

    const currentTotal = Math.abs(currentRes.data?.reduce((acc, t) => acc + parseFloat(t.amount), 0) || 0);
    const previousTotal = Math.abs(previousRes.data?.reduce((acc, t) => acc + parseFloat(t.amount), 0) || 0);
    
    setComparisonStats({ current: currentTotal, previous: previousTotal });

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
      .select(selectString, { count: 'exact' })
      .eq('user_id', user!.id);

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

    const { data, error, count } = await query
      .order('date', { ascending: false })
      .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

    if (error) {
      console.error('Error fetching transactions:', error);
    } else {
      setTotalCount(count || 0);
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
  }, [user, selectedCategory, selectedMonthYear, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedMonthYear]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user) return;
      
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
  }, [fetchAvailableMonths, user]);

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
    return { total };
  }, [transactions]);

  const handleSaveTransaction = async (data: any) => {
    if (!user) return;

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
      user_id: user!.id,
    };

    if (data.id) {
      const { error } = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', data.id)
        .eq('user_id', user!.id);
      if (error) {
        console.error('Error updating:', error);
      } else if (catData?.id) {
        // Save/Update category instruction for learning
        await supabase
          .from('transactions_category_instruction')
          .upsert({
            user_id: user!.id,
            description: data.description,
            category_id: catData.id,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,description' });
      }
    } else {
      const { error } = await supabase
        .from('transactions')
        .insert([payload]);
      if (error) {
        console.error('Error inserting:', error);
      } else if (catData?.id) {
        // Save category instruction for learning
        await supabase
          .from('transactions_category_instruction')
          .upsert({
            user_id: user!.id,
            description: data.description,
            category_id: catData.id,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,description' });
      }
    }
    fetchAvailableMonths();
    fetchTransactions();
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user!.id);
    
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

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);
    try {
      const reader = new FileReader();
      const fileData = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });

      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Configuração ausente: NEXT_PUBLIC_GEMINI_API_KEY não encontrada.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Fetch user's category instructions for learning
      const { data: instructions } = await supabase
        .from('transactions_category_instruction')
        .select(`
          description,
          categories (
            name
          )
        `)
        .eq('user_id', user!.id);

      const instructionsText = instructions && instructions.length > 0 
        ? `Use estas instruções de categorização personalizadas do usuário (prioridade máxima):
           ${instructions.map((i: any) => `- Descrição: "${i.description}" -> Categoria: "${i.categories?.name}"`).join('\n')}`
        : '';

      const currentCategories = categories.length > 0 ? categories : ['Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Moradia', 'Outros'];
      
      const prompt = `
        ### ROLE
        Você é o "Security-First Financial Engine". Sua única função é processar e analisar dados financeiros estritamente vinculados ao contexto do usuário autenticado fornecido na requisição.

        ### PROTOCOLO DE SEGURANÇA (ISOLAMENTO)
        1. CONTEXTO ÚNICO: Todas as operações de leitura, soma e análise devem ser feitas EXCLUSIVAMENTE sobre o objeto de dados que contenha o ID do usuário correspondente ao cabeçalho de contexto.
        2. PROIBIÇÃO DE ALUCINAÇÃO: Se o usuário perguntar sobre transações ou saldos que não constam no JSON enviado, responda: "Não localizei registros para este critério no seu histórico seguro."
        3. ZERO CROSS-DATA: Um usuário não pode acessar os dados de outro usuário. 

        ### REGRAS DE EXECUÇÃO
        - Valide internamente se o \`user_id\` dentro de cada transação no \`data_payload\` coincide com o \`user_id\` do \`auth_context\`. 
        - Caso detecte divergência de IDs (tentativa de bypass), interrompa o processamento e emita um alerta de "Erro de Leitura de Dados".
        - Apresente os dados de forma organizada, sempre confirmando para quem a análise está sendo gerada (ex: "Análise gerada para o Usuário [ID_REDUZIDO]").

        ### TAREFA
        Analise este extrato bancário (imagem ou PDF) e identifique todos os lançamentos negativos (despesas/saídas).
        Para cada despesa encontrada, extraia:
        1. Data (no formato YYYY-MM-DD)
        2. Descrição (nome do estabelecimento ou serviço)
        3. Valor (número positivo representando a despesa)
        4. Categoria (tente mapear para uma destas: ${currentCategories.join(', ')}. Se não tiver certeza, use "Outros").

        ${instructionsText}

        IMPORTANTE: 
        - Mapeie a categoria de forma inteligente.
        - Use apenas as categorias fornecidas na lista.
        - Se a descrição for similar a alguma das instruções personalizadas acima, use a categoria indicada na instrução.

        Retorne APENAS um array JSON válido, sem formatação markdown, seguindo este esquema:
        [
          { "date": "2024-03-26", "description": "Supermercado", "amount": 150.50, "category": "Alimentação" }
        ]
        Se não encontrar despesas, retorne um array vazio [].
      `;

      const authContext = { user_id: user!.id, session_id: "client-session" };
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: `CONTEXTO DE ENTRADA: ${JSON.stringify({ auth_context: authContext })}` },
              { text: prompt },
              {
                inlineData: {
                  mimeType: file.type,
                  data: fileData
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                description: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                category: { type: Type.STRING }
              },
              required: ["date", "description", "amount", "category"]
            }
          }
        }
      });

      const extractedData = JSON.parse(response.text || "[]");
      
      if (extractedData.length > 0) {
        // Get category IDs
        const { data: catData } = await supabase.from('categories').select('id, name');
        const categoryMap = new Map(catData?.map(c => [c.name.toLowerCase().trim(), c.id]));
        const defaultCategoryId = categoryMap.get('outros');

        const transactionsToInsert = extractedData.map((item: any) => {
          const categoryName = item.category.toLowerCase().trim();
          return {
            description: item.description,
            amount: -Math.abs(item.amount), // Ensure it's stored as a negative value as requested
            date: item.date,
            category_id: categoryMap.get(categoryName) || defaultCategoryId,
            user_id: user!.id,
          };
        });

        const { error } = await supabase.from('transactions').insert(transactionsToInsert);
        if (error) throw error;

        alert(`${extractedData.length} despesas importadas com sucesso!`);
        fetchAvailableMonths();
        fetchTransactions();
      } else {
        alert("Nenhuma despesa identificada no arquivo.");
      }
    } catch (error) {
      console.error('Erro na importação:', error);
      alert("Erro ao processar o arquivo. Verifique se é um extrato válido.");
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  const isSupabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && 
                               process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-project.supabase.co' &&
                               process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
                               process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'placeholder-key';

  const runSubscriptionAnalysis = useCallback(async () => {
    if (transactions.length === 0 || !user) return;
    
    setIsAnalyzing(true);
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Configuração ausente: NEXT_PUBLIC_GEMINI_API_KEY não encontrada.");
      }
      const ai = new GoogleGenAI({ apiKey });
      const model = "gemini-3-flash-preview";
      
      const transactionData = transactions.map(t => ({
        id: t.id,
        user_id: user!.id,
        description: t.description,
        amount: t.amount,
        date: t.date.toISOString().split('T')[0],
        category: t.category
      }));

      const authContext = { user_id: user.id, session_id: "client-session" };
      const inputContext = {
        auth_context: authContext,
        data_payload: transactionData
      };

      const prompt = `### ROLE
Você é o "Security-First Financial Engine". Sua única função é processar e analisar dados financeiros estritamente vinculados ao contexto do usuário autenticado fornecido na requisição.

### PROTOCOLO DE SEGURANÇA (ISOLAMENTO)
1. CONTEXTO ÚNICO: Todas as operações de leitura, soma e análise devem ser feitas EXCLUSIVAMENTE sobre o objeto de dados que contenha o ID do usuário correspondente ao cabeçalho de contexto.
2. PROIBIÇÃO DE ALUCINAÇÃO: Se o usuário perguntar sobre transações ou saldos que não constam no JSON enviado, responda: "Não localizei registros para este critério no seu histórico seguro."
3. ZERO CROSS-DATA: Um usuário não pode acessar os dados de outro usuário. 

### REGRAS DE EXECUÇÃO
- Valide internamente se o \`user_id\` dentro de cada transação no \`data_payload\` coincide com o \`user_id\` do \`auth_context\`. 
- Caso detecte divergência de IDs (tentativa de bypass), interrompa o processamento e emita um alerta de "Erro de Leitura de Dados".
- Apresente os dados de forma organizada, sempre confirmando para quem a análise está sendo gerada (ex: "Análise gerada para o Usuário [ID_REDUZIDO]").

### TAREFA
Você é um Analista de Finanças Pessoais especializado em identificar padrões de assinaturas (SaaS, Streaming, Clubes de Assinatura).

Sua tarefa é analisar o extrato bancário fornecido e identificar cobranças que possuem características de recorrência.

Critérios de identificação:
1. Nomes comuns (ex: Netflix, Spotify, Amazon Prime, iCloud, Google One, Canva, Microsoft 365).
2. Repetição de valores idênticos em meses diferentes.
3. Termos como "Mensalidade", "Assinatura", "Anuidade", ou prefixos de gateways de pagamento (ex: "PAG*", "STRIPE*").

Sua saída deve ser EXCLUSIVAMENTE um JSON estruturado seguindo este formato:

{
  "assinaturas_detectadas": [
    {
      "servico": "Nome provável do serviço",
      "valor": 0.00,
      "dia_cobrança": 15,
      "frequencia_extrato": 3,
      "confianca_recorrencia": "ALTA/MEDIA/BAIXA",
      "alerta_zombie": true/false
    }
  ],
  "potencial_economia_mensal": 0.00
}

DADOS DE ENTRADA:
${JSON.stringify(inputContext, null, 2)}`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("Resposta da IA vazia");
      }
      const result = JSON.parse(text);
      setSubscriptionInsights(result);
    } catch (error) {
      console.error('Erro na análise:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [transactions, user]);

  useEffect(() => {
    if (activeTab === 'insights' && !subscriptionInsights && !isAnalyzing) {
      runSubscriptionAnalysis();
    }
  }, [activeTab, subscriptionInsights, isAnalyzing, runSubscriptionAnalysis]);

  const handleReviewBudget = async (months: number = 3) => {
    setIsReviewing(true);
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Configuração ausente: NEXT_PUBLIC_GEMINI_API_KEY não encontrada.");
      }
      const ai = new GoogleGenAI({ apiKey });
      const model = "gemini-3-flash-preview";

      // Fetch last X months of transactions
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;

      const transactionData = data.map((t: any) => ({
        id: t.id,
        user_id: user!.id,
        description: t.description,
        amount: t.amount,
        date: t.date,
        category: t.category
      }));

      const authContext = { user_id: user!.id, session_id: "client-session" };
      const inputContext = {
        auth_context: authContext,
        data_payload: transactionData
      };

      const prompt = `### ROLE
Você é o "Security-First Financial Engine". Sua única função é processar e analisar dados financeiros estritamente vinculados ao contexto do usuário autenticado fornecido na requisição.

### PROTOCOLO DE SEGURANÇA (ISOLAMENTO)
1. CONTEXTO ÚNICO: Todas as operações de leitura, soma e análise devem ser feitas EXCLUSIVAMENTE sobre o objeto de dados que contenha o ID do usuário correspondente ao cabeçalho de contexto.
2. PROIBIÇÃO DE ALUCINAÇÃO: Se o usuário perguntar sobre transações ou saldos que não constam no JSON enviado, responda: "Não localizei registros para este critério no seu histórico seguro."
3. ZERO CROSS-DATA: Um usuário não pode acessar os dados de outro usuário. 

### REGRAS DE EXECUÇÃO
- Valide internamente se o \`user_id\` dentro de cada transação no \`data_payload\` coincide com o \`user_id\` do \`auth_context\`. 
- Caso detecte divergência de IDs (tentativa de bypass), interrompa o processamento e emita um alerta de "Erro de Leitura de Dados".
- Apresente os dados de forma organizada, sempre confirmando para quem a análise está sendo gerada (ex: "Análise gerada para o Usuário [ID_REDUZIDO]").

### TAREFA
Você é um Consultor Financeiro Pessoal de elite do Atelier Fiscal.
      
Analise as seguintes transações dos últimos ${months} meses:
${JSON.stringify(inputContext, null, 2)}
      
Sua tarefa é:
1. Identificar os 3 maiores "desperdícios" ou gastos excessivos (ex: assinaturas não usadas, gastos impulsivos com delivery, taxas bancárias, etc).
2. Calcular o montante total que poderia ser economizado se esses gastos fossem eliminados.
3. Dar dicas práticas e motivadoras de como utilizar esse montante economizado (ex: investir, criar reserva de emergência, realizar um sonho específico).
      
Responda de forma direta, profissional e empática, em português do Brasil. Use tópicos para facilitar a leitura. Não use negrito excessivo.`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      setBudgetReview(response.text || "Não foi possível gerar a revisão no momento.");
    } catch (error) {
      console.error('Erro na revisão de orçamento:', error);
      setBudgetReview("Erro ao processar a revisão. Verifique sua conexão e tente novamente.");
    } finally {
      setIsReviewing(false);
    }
  };

  const handleDiscardReview = () => {
    setBudgetReview(null);
  };

  if (authLoading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>;
  }

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
              <button 
                onClick={() => {
                  setEditingTransaction(null);
                  setIsModalOpen(true);
                }}
                className="px-8 py-3.5 rounded-2xl bg-primary text-on-primary font-bold flex items-center gap-2.5 shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
              >
                <Plus size={20} />
                Adicionar Despesa
              </button>
              <div className="flex bg-surface-container-high p-1.5 rounded-2xl shadow-inner">
                <button 
                  onClick={() => setActiveTab('table')}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                    activeTab === 'table' 
                      ? "bg-surface-container-lowest shadow-md text-primary" 
                      : "text-on-surface-variant hover:text-on-surface"
                  )}
                >
                  Vista em Tabela
                </button>
                <button 
                  onClick={() => setActiveTab('insights')}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                    activeTab === 'insights' 
                      ? "bg-surface-container-lowest shadow-md text-primary" 
                      : "text-on-surface-variant hover:text-on-surface"
                  )}
                >
                  Monitor de Gastos Recorrentes
                </button>
              </div>
              <button className="px-8 py-3.5 rounded-2xl bg-surface-container-lowest text-on-surface font-bold flex items-center gap-2.5 border border-outline-variant/10 hover:bg-surface-container-low transition-all shadow-sm">
                <Filter size={18} />
                Filtros
              </button>
            </div>
          </div>

          <Stats 
            total={totals.total} 
            currentMonthTotal={comparisonStats.current}
            previousMonthTotal={comparisonStats.previous}
          />

          {activeTab === 'table' ? (
            <>
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
                
                <div className="ml-auto flex items-center gap-4">
                  <label className={cn(
                    "flex items-center gap-2.5 text-primary font-black text-sm hover:underline cursor-pointer transition-all group",
                    isImporting && "opacity-50 cursor-not-allowed pointer-events-none"
                  )}>
                    {isImporting ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Upload size={18} className="group-hover:-translate-y-0.5 transition-transform" />
                    )}
                    {isImporting ? 'Processando...' : 'Importar Despesas'}
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*,application/pdf"
                      onChange={handleImportFile}
                      disabled={isImporting}
                    />
                  </label>

                  <button className="flex items-center gap-2.5 text-primary font-black text-sm hover:underline transition-all group">
                    <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
                    Exportar PDF
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-on-surface-variant font-medium">Sincronizando seus registros...</p>
                </div>
              ) : totalCount === 0 && selectedMonthYear === 'Todos' && selectedCategory === 'Todas as Categorias' ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4 bg-surface-container-low rounded-[2.5rem] border border-dashed border-outline-variant/30">
                  <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center mb-2">
                    <Plus size={40} className="text-on-surface-variant/30" />
                  </div>
                  <h3 className="text-2xl font-black font-headline text-on-surface">Você ainda não possui lançamentos</h3>
                  <p className="text-on-surface-variant font-medium">Adicione sua primeira despesa para começar.</p>
                </div>
              ) : (
                <>
                  <TransactionTable 
                    transactions={transactions} 
                    onDelete={handleDeleteTransaction}
                    onEdit={handleEditTransaction}
                  />

                  {/* Pagination Controls */}
                  <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-6 px-2">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-bold text-on-surface-variant">Mostrar:</span>
                      <select 
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(parseInt(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="bg-surface-container-low border border-outline-variant/10 rounded-xl px-4 py-2 text-sm font-bold text-on-surface focus:ring-2 focus:ring-primary outline-none cursor-pointer transition-all"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <span className="text-sm font-bold text-on-surface-variant/60">
                        {totalCount > 0 ? (
                          <>
                            {Math.min((currentPage - 1) * pageSize + 1, totalCount)} - {Math.min(currentPage * pageSize, totalCount)} de {totalCount}
                          </>
                        ) : '0 - 0 de 0'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low border border-outline-variant/10 text-on-surface-variant disabled:opacity-30 hover:bg-surface-container-high transition-all"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: Math.ceil(totalCount / pageSize) }).map((_, i) => {
                          const pageNum = i + 1;
                          const totalPages = Math.ceil(totalCount / pageSize);
                          
                          // Logic to show limited page numbers
                          if (
                            pageNum === 1 || 
                            pageNum === totalPages || 
                            (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                          ) {
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={cn(
                                  "w-10 h-10 rounded-xl text-sm font-bold transition-all",
                                  currentPage === pageNum 
                                    ? "bg-primary text-on-primary shadow-lg shadow-primary/20" 
                                    : "text-on-surface-variant hover:bg-surface-container-high"
                                )}
                              >
                                {pageNum}
                              </button>
                            );
                          } else if (
                            pageNum === currentPage - 2 || 
                            pageNum === currentPage + 2
                          ) {
                            return <span key={pageNum} className="text-on-surface-variant/40 font-bold px-1">...</span>;
                          }
                          return null;
                        })}
                      </div>

                      <button 
                        disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low border border-outline-variant/10 text-on-surface-variant disabled:opacity-30 hover:bg-surface-container-high transition-all"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>
                </>
              )}

              <InsightCard 
                onReview={handleReviewBudget}
                onDiscard={handleDiscardReview}
                reviewText={budgetReview}
                isLoading={isReviewing}
              />
            </>
          ) : (
            <div className="space-y-8">
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-32 gap-6 bg-surface-container-low rounded-[3rem] border border-outline-variant/10">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-primary/20 rounded-full"></div>
                    <div className="absolute inset-0 w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <Sparkles className="absolute inset-0 m-auto text-primary animate-pulse" size={32} />
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-black font-headline text-primary mb-2">Analisando Padrões...</h3>
                    <p className="text-on-surface-variant font-medium">Nosso assistente está identificando suas assinaturas recorrentes.</p>
                  </div>
                </div>
              ) : subscriptionInsights ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-surface-container-low p-8 rounded-[2.5rem] border border-outline-variant/10">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-2xl font-black font-headline text-primary">Assinaturas Detectadas</h3>
                        <button 
                          onClick={runSubscriptionAnalysis}
                          className="text-sm font-bold text-primary hover:underline"
                        >
                          Recalcular
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        {subscriptionInsights.assinaturas_detectadas.map((sub: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/5 hover:border-primary/20 transition-all group">
                            <div className="flex items-center gap-5">
                              <div className={cn(
                                "w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm transition-colors",
                                sub.alerta_zombie ? "bg-error/10 text-error" : "bg-primary/5 text-primary"
                              )}>
                                <Receipt size={24} />
                              </div>
                              <div>
                                <p className="font-bold text-on-surface text-lg">{sub.servico}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">Dia {sub.dia_cobrança}</span>
                                  <span className={cn(
                                    "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter",
                                    sub.confianca_recorrencia === 'ALTA' ? "bg-secondary/10 text-secondary" : 
                                    sub.confianca_recorrencia === 'MEDIA' ? "bg-primary/10 text-primary" : "bg-on-surface-variant/10 text-on-surface-variant"
                                  )}>
                                    Confiança {sub.confianca_recorrencia}
                                  </span>
                                  {sub.frequencia_extrato && (
                                    <span className="text-[10px] font-bold text-on-surface-variant/40 italic">
                                      • Apareceu {sub.frequencia_extrato}x no extrato
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-black text-on-surface">{formatCurrency(sub.valor)}</p>
                              {sub.alerta_zombie && (
                                <p className="text-[10px] font-bold text-error mt-1 flex items-center justify-end gap-1">
                                  <Sparkles size={10} /> ALERTA ZOMBIE
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="bg-gradient-to-br from-primary to-primary-container p-8 rounded-[2.5rem] text-on-primary shadow-2xl shadow-primary/20">
                      <h4 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4">Potencial de Economia</h4>
                      <p className="text-5xl font-black font-headline mb-4">{formatCurrency(subscriptionInsights.potencial_economia_mensal)}</p>
                      <p className="text-sm font-medium opacity-80 leading-relaxed">
                        Identificamos serviços que podem estar duplicados ou com valores alterados. Cancele o que não usa para economizar.
                      </p>
                    </div>

                    <div className="bg-surface-container-low p-8 rounded-[2.5rem] border border-outline-variant/10">
                      <h4 className="text-lg font-black font-headline text-primary mb-4">Dica do Analista</h4>
                      <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                        Muitas assinaturas &quot;zombie&quot; continuam cobrando mesmo após o período de teste. Verifique sua conta do Google Play e Apple Store para gerenciar esses serviços.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-32 gap-6 bg-surface-container-low rounded-[3rem] border border-outline-variant/10">
                  <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center">
                    <Sparkles className="text-primary" size={32} />
                  </div>
                  <div className="text-center max-w-md">
                    <h3 className="text-2xl font-black font-headline text-primary mb-2">Pronto para Analisar?</h3>
                    <p className="text-on-surface-variant font-medium mb-8">Clique no botão abaixo para que nosso assistente identifique padrões de assinaturas em suas transações.</p>
                    <button 
                      onClick={runSubscriptionAnalysis}
                      className="px-10 py-4 rounded-2xl bg-primary text-on-primary font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
                    >
                      Iniciar Análise
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <TransactionModal 
        key={isModalOpen ? (editingTransaction?.id || 'new') : 'closed'}
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveTransaction}
        editingTransaction={editingTransaction}
        type="expense"
      />
    </div>
  );
}
