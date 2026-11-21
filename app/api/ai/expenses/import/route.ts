import { z } from 'zod';
import {
  GeminiSchema,
  generateGeminiContent,
  runAiRequest,
} from '@/lib/ai/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const fileSchema = z.object({
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  data: z.string()
    .min(1)
    .max(5_300_000)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
    .refine((value) => Buffer.byteLength(value, 'base64') <= 4 * 1024 * 1024),
}).strict();

const expenseSchema = z.array(z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(200),
  amount: z.number().positive().finite(),
  category: z.string().min(1).max(80),
}).strict()).max(500);

export async function POST(request: Request) {
  return runAiRequest(request, 'expense-import', fileSchema, async ({ body, client, user }) => {
    const [{ data: instructions, error: instructionsError }, { data: categories, error: categoriesError }] =
      await Promise.all([
        client.from('transactions_category_instruction')
          .select('description, transactions_categories(name)')
          .eq('user_id', user.id)
          .limit(100),
        client.from('transactions_categories').select('name').limit(100),
      ]);
    if (instructionsError || categoriesError) throw new Error('Unable to load expense context');

    const instructionsText = instructions?.length
      ? `Use estas instruções de categorização personalizadas do usuário (prioridade máxima):
${instructions.map((item: { description: string; transactions_categories: { name: string } | null }) => `- Descrição: "${item.description.slice(0, 200)}" -> Categoria: "${item.transactions_categories?.name.slice(0, 80)}"`).join('\n')}`
      : '';
    const currentCategories = categories?.map((category: { name: string }) => category.name.slice(0, 80)) ?? [
      'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Moradia', 'Outros',
    ];
    const prompt = `
### ROLE
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
[ { "date": "2024-03-26", "description": "Supermercado", "amount": 150.50, "category": "Alimentação" } ]
Se não encontrar despesas, retorne um array vazio [].
`;
    const text = await generateGeminiContent([{
      parts: [
        { text: 'CONTEXTO DE ENTRADA: {"auth_context":{"user_id":"authenticated-user"}}' },
        { text: prompt },
        { inlineData: { mimeType: body.mimeType, data: body.data } },
      ],
    }], {
      responseMimeType: 'application/json',
      responseSchema: GeminiSchema.array(GeminiSchema.object({
        date: GeminiSchema.string(),
        description: GeminiSchema.string(),
        amount: GeminiSchema.number(),
        category: GeminiSchema.string(),
      }, ['date', 'description', 'amount', 'category'])),
    });
    return expenseSchema.parse(JSON.parse(text));
  });
}
