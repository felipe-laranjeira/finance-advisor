import type { Metadata } from 'next';
import MarketHome from '@/components/MarketHome';
import {
  getVisibleMarketColumns,
  isMarketColumnId,
} from '@/lib/market/columns';
import { getPublicStocks } from '@/lib/market/public-data';

export const metadata: Metadata = {
  title: 'Ações da B3 | Financial Advisor',
  description:
    'Consulte indicadores fundamentalistas e compare empresas da bolsa brasileira. Conteúdo informativo, sem recomendação de investimento.',
};

export const dynamic = 'force-dynamic';

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchValue(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const sortParam = firstSearchValue(params.sort);
  const yieldParam = firstSearchValue(params.yield);
  const statusParam = firstSearchValue(params.status);
  const initialListState = {
    query: firstSearchValue(params.q) ?? '',
    sector: firstSearchValue(params.sector) ?? 'Todos os setores',
    yieldFilter:
      yieldParam === 'Acima de 5%' || yieldParam === 'Acima de 8%'
        ? yieldParam
        : 'Todos',
    statusFilter:
      statusParam &&
      ['Abaixo do teto', 'Entre teto e justo', 'Acima do justo', 'Não aplicável'].includes(statusParam)
        ? statusParam
        : 'Todas',
    sortKey: sortParam && isMarketColumnId(sortParam) ? sortParam : 'ticker',
    sortDirection: firstSearchValue(params.direction) === 'desc' ? 'desc' : 'asc',
    visibleColumns: getVisibleMarketColumns(params.cols),
  } as const;

  try {
    const stocks = await getPublicStocks();
    return (
      <MarketHome
        stocks={stocks}
        loadError={null}
        initialListState={initialListState}
      />
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unexpected public market error.';
    console.error('Não foi possível carregar os dados fundamentalistas públicos:', detail);
    return (
      <MarketHome
        stocks={[]}
        loadError="Não foi possível carregar os dados agora. Verifique a configuração do Supabase ou tente novamente mais tarde."
        initialListState={initialListState}
      />
    );
  }
}
