import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import MarketHome from '@/components/MarketHome';
import type { MarketQuote } from '@/components/MarketHome';

export const metadata: Metadata = {
  title: 'Ações da B3 | Financial Advisor',
  description:
    'Consulte indicadores fundamentalistas e compare empresas da bolsa brasileira. Conteúdo informativo, sem recomendação de investimento.',
};

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <MarketHome
        quotes={[]}
        quoteError="As cotações não puderam ser carregadas porque o Supabase não está configurado."
      />
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const { data, error } = await supabase
    .from('prices_latest')
    .select('ticker, price, quote_at, fetched_at, is_stale')
    .order('ticker');

  if (error) {
    console.error('Não foi possível carregar as cotações públicas:', error.message);
    return (
      <MarketHome
        quotes={[]}
        quoteError="Não foi possível carregar as cotações agora. Tente atualizar a página mais tarde."
      />
    );
  }

  const quotes: MarketQuote[] = data.map((quote) => ({
    ticker: quote.ticker,
    price: Number(quote.price),
    quoteAt: quote.quote_at,
    fetchedAt: quote.fetched_at,
    isStale: quote.is_stale,
  }));

  return <MarketHome quotes={quotes} quoteError={null} />;
}
