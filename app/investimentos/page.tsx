'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { InvestmentStats } from '@/components/InvestmentStats';
import { InvestmentAdvisor } from '@/components/InvestmentAdvisor';
import { InvestmentTable } from '@/components/InvestmentTable';
import { InvestmentModal } from '@/components/InvestmentModal';
import { Filter, Download, Calendar, Upload, Loader2, ChevronLeft, ChevronRight, TrendingUp, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { GoogleGenAI, Type } from "@google/genai";
import { cn, formatCurrency } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';

interface Investment {
  id: string;
  asset_name: string;
  broker: string;
  asset_type: string;
  balance: number;
  reference_date: string;
}

export default function InvestmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('Todos');
  const [isImporting, setIsImporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  const monthNames = useMemo(() => [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ], []);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    investments.forEach(inv => {
      totals[inv.asset_type] = (totals[inv.asset_type] || 0) + inv.balance;
    });
    return totals;
  }, [investments]);

  const fetchAvailableMonths = useCallback(async () => {
    if (!user) return;

    const isConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && 
                         process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-project.supabase.co';
    
    if (!isConfigured) return;

    try {
      const { data, error } = await supabase
        .from('investments')
        .select('reference_date')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching months:', error);
        return;
      }

      const months = new Set<string>();
      data?.forEach((item: any) => {
        const date = new Date(item.reference_date);
        const monthYear = `${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
        months.add(monthYear);
      });

      setAvailableMonths(Array.from(months).sort((a, b) => {
        const [mA, yA] = a.split(' ');
        const [mB, yB] = b.split(' ');
        const dateA = new Date(parseInt(yA), monthNames.indexOf(mA));
        const dateB = new Date(parseInt(yB), monthNames.indexOf(mB));
        return dateB.getTime() - dateA.getTime();
      }));
    } catch (err) {
      console.error('Erro de conexão ao buscar meses:', err);
    }
  }, [user, monthNames]);

  const fetchInvestments = useCallback(async () => {
    if (!user) return;

    const isConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && 
                         process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-project.supabase.co';
    
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      // Main query
      let query = supabase
        .from('investments')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id);

      if (selectedMonthYear !== 'Todos') {
        const [monthName, year] = selectedMonthYear.split(' ');
        const month = monthNames.indexOf(monthName);
        if (month !== -1) {
          const refDate = new Date(parseInt(year), month, 1).toISOString().split('T')[0];
          query = query.eq('reference_date', refDate);
        }
      }

      const { data, count, error } = await query
        .order('reference_date', { ascending: false })
        .order('asset_name', { ascending: true })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      if (error) {
        console.error('Error fetching investments:', error);
      } else {
        setInvestments(data || []);
        setTotalCount(count || 0);
      }
    } catch (err: any) {
      console.error('Erro de conexão ao buscar investimentos:', err);
    } finally {
      setLoading(false);
    }
  }, [user, selectedMonthYear, currentPage, pageSize, monthNames]);

  useEffect(() => {
    fetchAvailableMonths();
    fetchInvestments();
  }, [fetchAvailableMonths, fetchInvestments]);

  const handleSaveInvestment = async (data: any) => {
    if (!user) return;

    const payload = {
      user_id: user.id,
      asset_name: data.asset_name,
      broker: data.broker,
      asset_type: data.asset_type,
      balance: data.balance,
      reference_date: data.reference_date,
      updated_at: new Date().toISOString()
    };

    // UPSERT logic as requested: user_id, asset_name, broker, reference_date are unique
    const { error } = await supabase
      .from('investments')
      .upsert(payload, { onConflict: 'user_id,asset_name,broker,reference_date' });

    if (error) {
      console.error('Error saving investment:', error);
      alert('Erro ao salvar investimento.');
    } else {
      fetchAvailableMonths();
      fetchInvestments();
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('investments').delete().eq('id', id).eq('user_id', user.id);
    if (error) {
      console.error('Error deleting:', error);
    } else {
      fetchInvestments();
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);
    try {
      // EXPLICIT DB CHECK TO BE SURE USER EXISTS IN public.users
      const { data: dbUser, error: dbUserError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (dbUserError || !dbUser) {
        alert('Sessão inválida ou perfil não encontrado. Por favor, faça login novamente.');
        setIsImporting(false);
        return;
      }

      const reader = new FileReader();
      const fileData = await new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });

      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key ausente.");

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
        ### ROLE
        Você é o "Wealth Management Architect". Analise este extrato de corretora e extraia os saldos dos ativos.

        ### TAREFA
        Extraia uma lista de ativos com:
        1. asset_name: Nome ou ticker do ativo.
        2. broker: Nome da corretora/instituição.
        3. asset_type: Categoria (Ações, FIIs, Renda Fixa, Tesouro, Cripto, Outros).
        4. balance: Saldo monetário atual (número).
        5. reference_date: O primeiro dia do mês referente ao extrato (formato YYYY-MM-DD).

        Retorne APENAS um array JSON válido.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: file.type, data: fileData } }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                asset_name: { type: Type.STRING },
                broker: { type: Type.STRING },
                asset_type: { type: Type.STRING },
                balance: { type: Type.NUMBER },
                reference_date: { type: Type.STRING }
              },
              required: ["asset_name", "broker", "asset_type", "balance", "reference_date"]
            }
          }
        }
      });

      const extracted = JSON.parse(response.text || "[]");
      if (extracted.length > 0) {
        const payloads = extracted.map((item: any) => ({
          ...item,
          user_id: user.id,
          updated_at: new Date().toISOString()
        }));

        const { data, error } = await supabase
          .from('investments')
          .upsert(payloads, { onConflict: 'user_id,asset_name,broker,reference_date' })
          .select();

        if (error) throw error;

        // Feedback logic: check how many were new vs updated
        // In a real scenario with upsert, we might need to check existing records first to give precise counts,
        // but for simplicity, we'll report the total processed.
        alert(`${extracted.length} ativos processados (novos ou atualizados) com sucesso!`);
        fetchAvailableMonths();
        fetchInvestments();
      } else {
        alert("Nenhum dado extraído.");
      }
    } catch (error) {
      console.error('Erro na importação:', error);
      alert("Erro ao processar arquivo.");
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
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
          {/* 1. Titulo e Sub-Título */}
          <div className="mb-8">
            <h2 className="text-3xl md:text-5xl font-black text-on-surface font-headline tracking-tight mb-2">Investimentos</h2>
            <p className="text-on-surface-variant text-base md:text-lg font-medium opacity-80">Gestão consolidada de ativos e evolução patrimonial.</p>
          </div>
          
          {/* 2. Botão para adicionar e importar */}
          <div className="flex flex-wrap items-center gap-4 mb-8">
            <button 
              onClick={() => {
                setEditingInvestment(null);
                setIsModalOpen(true);
              }}
              className="px-6 md:px-8 py-3.5 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold flex items-center justify-center gap-2.5 shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95"
            >
              <TrendingUp size={20} />
              <span className="text-sm md:text-base">Adicionar</span>
            </button>
            
            <label className={cn(
              "px-6 md:px-8 py-3.5 rounded-2xl bg-surface-container-highest text-primary font-bold flex items-center justify-center gap-2.5 border border-outline-variant/10 hover:bg-surface-container-low transition-all shadow-sm cursor-pointer",
              isImporting && "opacity-50 cursor-not-allowed"
            )}>
              {isImporting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              <span className="text-sm md:text-base">{isImporting ? 'Importando...' : 'Importar'}</span>
              <input type="file" className="hidden" onChange={handleImportFile} disabled={isImporting} accept="image/*,application/pdf" />
            </label>
          </div>

          {/* 3. Botões de filtro */}
          <div className="flex flex-wrap items-center gap-4 mb-8">
            <div className="flex items-center gap-3 px-6 py-3 bg-surface-container-low rounded-full text-sm font-bold text-on-surface-variant border border-outline-variant/5">
              <Calendar size={18} className="text-primary" />
              <select 
                value={selectedMonthYear}
                onChange={(e) => setSelectedMonthYear(e.target.value)}
                className="bg-transparent border-none focus:ring-0 p-0 text-sm font-bold cursor-pointer outline-none"
              >
                <option value="Todos">Todos os Meses</option>
                {availableMonths.map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Cards com informações do mês e comparativos */}
          <InvestmentStats 
            total={investments.reduce((acc, i) => acc + i.balance, 0)} 
            categoryTotals={categoryTotals}
          />

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-on-surface-variant font-medium">Sincronizando sua carteira...</p>
            </div>
          ) : totalCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4 bg-surface-container-low rounded-[2.5rem] border border-dashed border-outline-variant/30">
              <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center mb-2">
                <TrendingUp size={40} className="text-on-surface-variant/30" />
              </div>
              <h3 className="text-2xl font-black font-headline text-on-surface">Sua carteira está vazia</h3>
              <p className="text-on-surface-variant font-medium">Adicione seu primeiro ativo ou importe um extrato.</p>
            </div>
          ) : (
            <>
              <InvestmentTable 
                investments={investments} 
                onDelete={handleDeleteInvestment}
                onEdit={(inv) => {
                  setEditingInvestment(inv);
                  setIsModalOpen(true);
                }}
              />

              <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-6 px-2 mb-12">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-on-surface-variant">Mostrar:</span>
                  <select 
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(parseInt(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-surface-container-low border border-outline-variant/10 rounded-xl px-4 py-2 text-sm font-bold text-on-surface outline-none cursor-pointer transition-all"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm font-bold text-on-surface-variant/60">
                    {totalCount > 0 ? `${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, totalCount)} de ${totalCount}` : '0 - 0 de 0'}
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

          {/* 4.1 Alpha Advisor após a tabela */}
          {user && !loading && totalCount > 0 && (
            <InvestmentAdvisor 
              investments={investments} 
              userId={user.id} 
            />
          )}
        </div>
      </main>

      <InvestmentModal 
        key={isModalOpen ? (editingInvestment?.id || 'new') : 'closed'}
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveInvestment}
        editingInvestment={editingInvestment}
      />
    </div>
  );
}
