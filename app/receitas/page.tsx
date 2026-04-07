'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { Stats } from '@/components/Stats';
import { TransactionTable } from '@/components/TransactionTable';
import { TransactionModal } from '@/components/TransactionModal';
import { Filter, Download, Calendar, Tag, Upload, Loader2, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const router = useRouter();

  const fetchAvailableMonths = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('incoming')
      .select('date')
      .eq('user_id', user.id)
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
        const monthYear = `${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
        months.add(monthYear);
      });

      setAvailableMonths(Array.from(months));
    }
  }, [user]);

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
      supabase.from('incoming').select('amount').eq('user_id', user.id).gte('date', startOfCurrent).lte('date', endOfCurrent),
      supabase.from('incoming').select('amount').eq('user_id', user.id).gte('date', startOfPrevious).lte('date', endOfPrevious)
    ]);

    const currentTotal = currentRes.data?.reduce((acc, t) => acc + parseFloat(t.amount), 0) || 0;
    const previousTotal = previousRes.data?.reduce((acc, t) => acc + parseFloat(t.amount), 0) || 0;
    
    setComparisonStats({ current: currentTotal, previous: previousTotal });

    let selectString = `
      *,
      incoming_categories (
        name
      )
    `;

    if (selectedCategory !== 'Todas as Categorias') {
      selectString = `
        *,
        incoming_categories!inner (
          name
        )
      `;
    }

    let query = supabase
      .from('incoming')
      .select(selectString, { count: 'exact' })
      .eq('user_id', user.id);

    if (selectedCategory !== 'Todas as Categorias') {
      query = query.eq('incoming_categories.name', selectedCategory);
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
      alert('Erro ao carregar receitas: ' + error.message);
    } else {
      setTotalCount(count || 0);
      const formatted = data.map((t: any) => ({
        id: t.id,
        date: new Date(t.date),
        description: t.description,
        subtext: '',
        category: t.incoming_categories?.name || 'Outros',
        status: 'Recebido',
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
      const { data: catData, error: catError } = await supabase
        .from('incoming_categories')
        .select('name')
        .order('name');
      
      if (mounted) {
        if (catError) {
          console.error('Error fetching categories:', catError);
          setCategories(['Salário', 'Freelance', 'Dividendos', 'Aluguel', 'Investimentos', 'Outros']);
        } else if (catData) {
          setCategories(catData.map(c => c.name));
        }
        if (user) {
          await fetchAvailableMonths();
        }
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

  const totals = useMemo(() => {
    const total = transactions.reduce((acc, t) => acc + t.amount, 0);
    return { total };
  }, [transactions]);

  const handleSaveTransaction = async (data: any) => {
    if (!user) return;

    // Find category ID
    const { data: catData, error: catError } = await supabase
      .from('incoming_categories')
      .select('id')
      .eq('name', data.category)
      .maybeSingle();

    if (catError) {
      console.error('Error fetching category:', catError);
    }

    const payload = {
      description: data.description,
      amount: Math.abs(data.amount), // Ensure positive for income
      date: data.date.toISOString().split('T')[0],
      category_id: catData?.id || null,
      user_id: user.id,
    };

    console.log('Attempting to save income:', payload);

    if (data.id) {
      const { error } = await supabase
        .from('incoming')
        .update(payload)
        .eq('id', data.id)
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error updating income:', error);
        alert('Erro ao atualizar receita: ' + error.message);
      }
    } else {
      const { error } = await supabase
        .from('incoming')
        .insert([payload]);
      
      if (error) {
        console.error('Error inserting income:', error);
        console.error('Payload attempted:', payload);
        alert('Erro ao inserir receita: ' + error.message + '\n\nDetalhes: ' + JSON.stringify(error));
      }
    }
    fetchAvailableMonths();
    fetchTransactions();
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('incoming')
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
        .from('incoming_category_instruction')
        .select(`
          description,
          incoming_categories (
            name
          )
        `)
        .eq('user_id', user!.id);

      const instructionsText = instructions && instructions.length > 0 
        ? `Use estas instruções de categorização personalizadas do usuário (prioridade máxima):
           ${instructions.map((i: any) => `- Descrição: "${i.description}" -> Categoria: "${i.incoming_categories?.name}"`).join('\n')}`
        : '';

      const currentCategories = categories.length > 0 ? categories : ['Salário', 'Freelance', 'Investimentos', 'Outros'];
      
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
        Analise este extrato bancário (imagem ou PDF) e identifique todos os lançamentos positivos (receitas/entradas).
        Para cada receita encontrada, extraia:
        1. Data (no formato YYYY-MM-DD)
        2. Descrição (nome da fonte pagadora ou serviço)
        3. Valor (número positivo representando a receita)
        4. Categoria (tente mapear para uma destas: ${currentCategories.join(', ')}. Se não tiver certeza, use "Outros").
        5. Tipo (mapeie como "ativa" para salários/serviços ou "passiva" para dividendos/aluguéis/investimentos).

        ${instructionsText}

        IMPORTANTE: 
        - Mapeie a categoria de forma inteligente.
        - Use apenas as categorias fornecidas na lista.
        - Se a descrição for similar a alguma das instruções personalizadas acima, use a categoria indicada na instrução.

        Retorne APENAS um array JSON válido, sem formatação markdown, seguindo este esquema:
        [
          { "date": "2024-03-26", "description": "Salário", "amount": 5000.00, "category": "Salário", "type": "ativa" }
        ]
        Se não encontrar receitas, retorne um array vazio [].
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
                category: { type: Type.STRING },
                type: { type: Type.STRING }
              },
              required: ["date", "description", "amount", "category", "type"]
            }
          }
        }
      });

      const extractedData = JSON.parse(response.text || "[]");
      
      if (extractedData.length > 0) {
        const { data: catData } = await supabase.from('incoming_categories').select('id, name');
        const categoryMap = new Map(catData?.map(c => [c.name.toLowerCase().trim(), c.id]));
        const defaultCategoryId = categoryMap.get('outros');

        const transactionsToInsert = extractedData.map((item: any) => {
          const categoryName = item.category.toLowerCase().trim();
          return {
            description: item.description,
            amount: Math.abs(item.amount),
            date: item.date,
            category_id: categoryMap.get(categoryName) || defaultCategoryId,
            user_id: user!.id,
            type: item.type === 'passiva' ? 'passiva' : 'ativa',
          };
        });

        const { error } = await supabase.from('incoming').insert(transactionsToInsert);
        if (error) throw error;

        alert(`${extractedData.length} receitas importadas com sucesso!`);
        fetchAvailableMonths();
        fetchTransactions();
      } else {
        alert("Nenhuma receita identificada no arquivo.");
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
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
            <div>
              <h2 className="text-5xl font-black text-on-surface font-headline tracking-tight mb-3">Receitas</h2>
              <p className="text-on-surface-variant text-lg font-medium">Gestão de suas entradas financeiras e rendimentos.</p>
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
                Adicionar Receita
              </button>
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
            title="Receitas Totais"
            type="income"
          />

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
                {isImporting ? 'Processando...' : 'Importar Receitas'}
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
          ) : (
            <>
              <TransactionTable 
                transactions={transactions} 
                onDelete={handleDeleteTransaction}
                onEdit={handleEditTransaction}
              />

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
                                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                            )}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (
                        pageNum === currentPage - 2 || 
                        pageNum === currentPage + 2
                      ) {
                        return <span key={pageNum} className="text-on-surface-variant/40">...</span>;
                      }
                      return null;
                    })}
                  </div>

                  <button 
                    disabled={currentPage === Math.ceil(totalCount / pageSize) || totalCount === 0}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low border border-outline-variant/10 text-on-surface-variant disabled:opacity-30 hover:bg-surface-container-high transition-all"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <TransactionModal 
        key={isModalOpen ? (editingTransaction?.id || 'new') : 'closed'}
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveTransaction}
        editingTransaction={editingTransaction}
        type="income"
      />
    </div>
  );
}
