import type { Metadata } from 'next';
import MarketHome from '@/components/MarketHome';
import { getPublicStocks } from '@/lib/market/public-data';

export const metadata: Metadata = {
  title: 'Ações da B3 | Financial Advisor',
  description:
    'Consulte indicadores fundamentalistas e compare empresas da bolsa brasileira. Conteúdo informativo, sem recomendação de investimento.',
};

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  try {
    const stocks = await getPublicStocks();
    return <MarketHome stocks={stocks} loadError={null} />;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unexpected public market error.';
    console.error('Não foi possível carregar os dados fundamentalistas públicos:', detail);
    return (
      <MarketHome
        stocks={[]}
        loadError="Não foi possível carregar os dados agora. Verifique a configuração do Supabase ou tente novamente mais tarde."
      />
    );
  }
}
