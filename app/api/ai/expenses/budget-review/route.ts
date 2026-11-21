import { z } from 'zod';
import { generateGeminiContent, runAiRequest } from '@/lib/ai/server';

export const maxDuration = 45;
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  months: z.number().int().min(1).max(12),
}).strict();

export async function POST(request: Request) {
  return runAiRequest(request, 'budget-review', requestSchema, async ({ body, client, user }) => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - body.months);
    const { data: transactions, error } = await client
      .from('expense_transactions')
      .select('id, description, amount, date, transactions_categories(name)')
      .eq('user_id', user.id)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(500);
    if (error) throw new Error('Unable to load expense transactions');

    const transactionData = (transactions ?? []).map((item: {
      id: string;
      description: string;
      amount: number;
      date: string;
      transactions_categories: { name: string } | null;
    }) => ({
      id: item.id,
      user_id: 'authenticated-user',
      description: item.description.slice(0, 200),
      amount: item.amount,
      date: item.date,
      category: item.transactions_categories?.name.slice(0, 80) || 'Outros',
    }));
    const inputContext = {
      auth_context: { user_id: 'authenticated-user' },
      data_payload: transactionData,
    };
    const prompt = `### ROLE
Você é o "Security-First Financial Engine". Sua única função é processar e analisar dados financeiros estritamente vinculados ao contexto do usuário autenticado fornecido na requisição.

### PROTOCOLO DE SEGURANÇA (ISOLAMENTO)
1. CONTEXTO ÚNICO: Todas as operações de leitura, soma e análise devem ser feitas EXCLUSIVAMENTE sobre o objeto de dados que contenha o ID do usuário correspondente ao cabeçalho de contexto.
2. PROIBIÇÃO DE ALUCINAÇÃO: Se o usuário perguntar sobre transações ou saldos que não constam no JSON enviado, responda: "Não localizei registros para este critério no seu histórico seguro."
3. ZERO CROSS-DATA: Um usuário não pode acessar os dados de outro usuário.

### REGRAS DE EXECUÇÃO
- Valide internamente se o user_id dentro de cada transação no data_payload coincide com o user_id do auth_context.
- Caso detecte divergência de IDs (tentativa de bypass), interrompa o processamento e emita um alerta de "Erro de Leitura de Dados".
- Apresente os dados de forma organizada, sempre confirmando para quem a análise está sendo gerada (ex: "Análise gerada para o Usuário [ID_REDUZIDO]").

### TAREFA
Você é um Consultor Financeiro Pessoal de elite do Atelier Fiscal.

Analise as seguintes transações dos últimos ${body.months} meses:
${JSON.stringify(inputContext, null, 2)}

Sua tarefa é:
1. Identificar os 3 maiores "desperdícios" ou gastos excessivos (ex: assinaturas não usadas, gastos impulsivos com delivery, taxas bancárias, etc).
2. Calcular o montante total que poderia ser economizado se esses gastos fossem eliminados.
3. Dar dicas práticas e motivadoras de como utilizar esse montante economizado (ex: investir, criar reserva de emergência, realizar um sonho específico).

Responda de forma direta, profissional e empática, em português do Brasil. Use tópicos para facilitar a leitura. Não use negrito excessivo.`;
    return generateGeminiContent(prompt);
  });
}
