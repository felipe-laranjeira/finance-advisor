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

const investmentSchema = z.array(z.object({
  asset_name: z.string().min(1).max(120),
  broker: z.string().min(1).max(120),
  asset_type: z.string().min(1).max(60),
  balance: z.number().finite(),
  reference_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict()).max(500);

export async function POST(request: Request) {
  return runAiRequest(request, 'investment-import', fileSchema, async ({ body, client, user }) => {
    const { data: instructions, error } = await client
      .from('investments_category_instruction')
      .select('asset_name, investiments_categories(name)')
      .eq('user_id', user.id)
      .limit(100);
    if (error) throw new Error('Unable to load investment context');

    const instructionsText = instructions?.length
      ? `Use estas instruções de categorização personalizadas do usuário (prioridade máxima):
${instructions.map((item: { asset_name: string; investiments_categories: { name: string } | null }) => `- Ativo: "${item.asset_name.slice(0, 120)}" -> Categoria: "${item.investiments_categories?.name.slice(0, 80)}"`).join('\n')}`
      : '';
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

${instructionsText}

IMPORTANTE:
- Mapeie a categoria de forma inteligente.
- Se o ativo for similar a alguma das instruções personalizadas acima, use a categoria indicada na instrução.

Retorne APENAS um array JSON válido.
`;
    const text = await generateGeminiContent([{
      parts: [
        { text: prompt },
        { inlineData: { mimeType: body.mimeType, data: body.data } },
      ],
    }], {
      responseMimeType: 'application/json',
      responseSchema: GeminiSchema.array(GeminiSchema.object({
        asset_name: GeminiSchema.string(),
        broker: GeminiSchema.string(),
        asset_type: GeminiSchema.string(),
        balance: GeminiSchema.number(),
        reference_date: GeminiSchema.string(),
      }, ['asset_name', 'broker', 'asset_type', 'balance', 'reference_date'])),
    });
    return investmentSchema.parse(JSON.parse(text));
  });
}
