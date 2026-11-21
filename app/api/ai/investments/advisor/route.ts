import { z } from 'zod';
import { generateGeminiContent, runAiRequest } from '@/lib/ai/server';

export const maxDuration = 45;
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  profile: z.enum(['Conservador', 'Moderado', 'Arrojado']),
  investmentIds: z.array(z.string().uuid()).min(1).max(200),
}).strict();

export async function POST(request: Request) {
  return runAiRequest(request, 'investment-advisor', requestSchema, async ({ body, client, user }) => {
    const { data: investments, error } = await client
      .from('investments')
      .select('asset_name, broker, asset_type, balance, reference_date')
      .eq('user_id', user.id)
      .in('id', body.investmentIds)
      .order('reference_date', { ascending: false })
      .limit(200);
    if (error) throw new Error('Unable to load investments');

    const portfolioSummary = (investments ?? []).map((item: {
      asset_name: string;
      broker: string;
      asset_type: string;
      balance: number | string;
      reference_date: string;
    }) =>
      `- ${item.asset_name.slice(0, 120)} (${item.asset_type.slice(0, 60)}) na ${item.broker.slice(0, 120)}: R$ ${Number(item.balance).toLocaleString('pt-BR')}`
    ).join('\n');
    const prompt = `
### PERSONA
Você é o "Alpha Investment Advisor", um especialista sênior em alocação de ativos e mercado financeiro brasileiro. Seu tom é profissional, analítico e pedagógico.

### OBJETIVO
Analisar a carteira de investimentos do usuário e fornecer recomendações baseadas no perfil de risco selecionado: ${body.profile}.

### DADOS DA CARTEIRA ATUAL
${portfolioSummary || 'O usuário ainda não possui ativos cadastrados.'}

### CONTEXTO DE MERCADO
- Taxa Selic: Use a ferramenta de busca para encontrar a taxa Selic atual no Brasil.
- Poupança: Rendimento de 0,5% am + TR (sempre inferior a CDBs de 100% CDI).
- Inflação (IPCA): Considere a meta de aprox. 4% a.a.

### REGRAS DE ANÁLISE POR PERFIL
1. CONSERVADOR: Foco em liquidez e preservação de capital. Prioridade: Tesouro Selic, CDBs 100% CDI, LCI/LCA. Recomendar saída de Poupança para CDB de bancão.
2. MODERADO: Equilíbrio. Aceita até 20-30% em Renda Variável (FIIs e Ações de Dividendos).
3. ARROJADO: Foco em crescimento. Aceita maior exposição a Ações, ETFs internacionais e Small Caps.

### FORMATO DE SAÍDA (Markdown)
Sua resposta deve ser estruturada em 4 seções:
1. **Diagnóstico da Carteira**: Resumo da diversificação atual.
2. **Ações Recomendadas**: Lista clara com [COMPRA], [VENDA] ou [TROCA].
3. **Observações de Risco**: Um aviso sobre volatilidade e reserva de emergência.
4. **Cenário atual do mercado**: Taxa selic atual e principais indicadores economicos.

### RESTRIÇÕES DE SEGURANÇA
- Nunca peça dados sensíveis.
- Inclua sempre o Disclaimer: "Esta é uma análise baseada em IA e não constitui recomendação de compra oficial. Consulte um assessor CVM."
`;
    return generateGeminiContent(prompt, { tools: [{ googleSearch: {} }] });
  });
}
