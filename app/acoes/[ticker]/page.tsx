import { cache, type ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import StockLogo from '@/components/StockLogo';
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatPercent,
  formatQuarter,
  formatRatio,
  formatTimestamp,
  formatValuationStatus,
  valuationStatusStyle,
} from '@/lib/market/format';
import { getActiveStockSymbols, getStockAnalysis } from '@/lib/market/public-data';
import { getPublicSiteUrl } from '@/lib/market/site-url';
import { reasonLabel, type MarketMetric, type MarketStock } from '@/lib/market/public-stocks';

export const revalidate = 10800;
export const dynamicParams = true;

type RouteParams = {
  ticker: string;
};

type PageProps = {
  params: Promise<RouteParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const getCachedStockAnalysis = cache(getStockAnalysis);
const listQueryKeys = ['q', 'sector', 'yield', 'status', 'sort', 'direction', 'cols'] as const;

function listQueryString(values: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const key of listQueryKeys) {
    const value = values[key];
    if (typeof value === 'string' && value) params.set(key, value);
    if (Array.isArray(value) && value[0]) params.set(key, value[0]);
  }
  return params.toString();
}

function formatMissingReason(reasons: MarketStock['reasons'][MarketMetric]): string {
  if (!reasons?.length) return 'Dado indisponível na base consultada.';
  return reasons.map(reasonLabel).join('; ');
}

function MetricCard({
  label,
  value,
  description,
  period,
  reason,
}: {
  label: string;
  value: string;
  description: string;
  period: string;
  reason?: string;
}) {
  return (
    <article className="rounded-xl border border-[#dce6f7] bg-white p-4">
      <h3 className="font-bold">{label}</h3>
      <p className="mt-2 text-2xl font-extrabold tracking-tight">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-600">{description}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{period}</p>
      {reason ? <p className="mt-1 text-xs leading-5 text-amber-800">{reason}</p> : null}
    </article>
  );
}

function MetricGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const headingId = `group-${title.toLocaleLowerCase('pt-BR').replaceAll(' ', '-')}`;
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 className="text-lg font-extrabold" id={headingId}>{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function ValuationCard({
  title,
  value,
  formula,
  formulaDescription,
  margin,
  windowDescription,
  reason,
}: {
  title: string;
  value: number | null;
  formula: string;
  formulaDescription: string;
  margin: number | null;
  windowDescription?: string;
  reason?: string;
}) {
  return (
    <article className="rounded-xl border border-[#dce6f7] bg-white p-4">
      <h2 className="text-sm font-bold text-slate-600">{title}</h2>
      <p className="mt-2 text-2xl font-extrabold">{formatCurrency(value)}</p>
      <p className="mt-2 text-xs font-semibold text-[#1d4ed8]">{formula}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{formulaDescription}</p>
      {windowDescription ? (
        <p className="mt-1 text-xs leading-5 text-slate-600">{windowDescription}</p>
      ) : null}
      <p className="mt-2 text-xs font-medium text-slate-700">
        Margem de segurança: {formatPercent(margin)}
      </p>
      {reason ? <p className="mt-1 text-xs leading-5 text-amber-800">{reason}</p> : null}
    </article>
  );
}

function formatAnnualPeriod(stock: MarketStock): string {
  return stock.annualFinancialPeriodEnd
    ? `Anual consolidado · ${formatDate(stock.annualFinancialPeriodEnd)}`
    : 'Sem demonstração anual consolidada disponível';
}

function formatResultPeriod(stock: MarketStock): string {
  if (stock.annualPeriodEnd) return `Anual consolidado · ${formatDate(stock.annualPeriodEnd)}`;
  if (stock.ttmPeriodEnd) return `TTM · ${formatQuarter(stock.ttmPeriodEnd)}`;
  return 'Período de referência indisponível';
}

function formatTtmPeriod(stock: MarketStock): string {
  return stock.ttmPeriodEnd
    ? `TTM · ${formatQuarter(stock.ttmPeriodEnd)}`
    : 'TTM · período de referência indisponível';
}

function stockCanonical(ticker: string): URL {
  const url = new URL(`/acoes/${ticker}`, getPublicSiteUrl());
  return url;
}

export async function generateStaticParams(): Promise<RouteParams[]> {
  const symbols = await getActiveStockSymbols();
  return symbols.map((ticker) => ({ ticker }));
}

export async function generateMetadata({ params }: Pick<PageProps, 'params'>): Promise<Metadata> {
  const { ticker: routeTicker } = await params;
  if (!/^[A-Za-z0-9]{4,6}$/.test(routeTicker)) {
    return {
      title: 'Ação não encontrada | Financial Advisor',
      description: 'Consulte a lista pública de ações da B3.',
    };
  }

  const ticker = routeTicker.toUpperCase();
  const stock = await getCachedStockAnalysis(ticker);
  if (!stock) {
    return {
      title: 'Ação não encontrada | Financial Advisor',
      description: 'Consulte a lista pública de ações ativas da B3.',
    };
  }

  return {
    title: `${stock.ticker}: preço teto, preço justo e indicadores | Financial Advisor`,
    description: `Indicadores fundamentalistas de ${stock.company} (${stock.ticker}), com fontes, períodos de referência e fórmulas. Conteúdo informativo, sem recomendação de investimento.`,
    alternates: {
      canonical: stockCanonical(stock.ticker),
    },
  };
}

export default async function StockPage({ params, searchParams }: PageProps) {
  const [{ ticker: routeTicker }, rawSearchParams] = await Promise.all([params, searchParams]);
  if (!/^[A-Za-z0-9]{4,6}$/.test(routeTicker)) notFound();

  const ticker = routeTicker.toUpperCase();
  const query = listQueryString(rawSearchParams);
  if (routeTicker !== ticker) {
    redirect(`/acoes/${ticker}${query ? `?${query}` : ''}`);
  }

  const stock = await getCachedStockAnalysis(ticker);
  if (!stock) notFound();

  const listHref = query ? `/?${query}#acoes` : '/#acoes';
  const annualPeriod = formatAnnualPeriod(stock);
  const resultPeriod = formatResultPeriod(stock);
  const ttmPeriod = formatTtmPeriod(stock);
  const priceDate = stock.quoteAt ? formatTimestamp(stock.quoteAt) : 'Data da cotação indisponível';
  const ceilingWindow =
    stock.ceilingWindow === 'avg_5_full_calendar_years'
      ? 'Janela: média dos cinco anos civis completos'
      : stock.ceilingWindow === 'last_12_months'
        ? 'Janela: dividendos e JCP dos últimos 12 meses'
        : 'Janela de dividendos indisponível';
  const fundamentalsDate = stock.fundamentalsFetchedAt
    ? formatTimestamp(stock.fundamentalsFetchedAt)
    : 'Data dos fundamentos indisponível';
  const priceStale = stock.priceIsStale;
  const fundamentalsStale = stock.fundamentalsAreStale;
  const stale = priceStale || fundamentalsStale;
  const ceilingReason = [
    ...(stock.ceiling === null ? [formatMissingReason(stock.reasons.ceiling)] : []),
    ...(stock.ceilingMarginOfSafety === null && stock.price === null
      ? ['Cotação indisponível; margem de segurança não calculada.']
      : []),
  ].join(' ');
  const fairPriceReason = [
    ...(stock.fairPrice === null ? [formatMissingReason(stock.reasons.fairPrice)] : []),
    ...(stock.fairMarginOfSafety === null && stock.price === null
      ? ['Cotação indisponível; margem de segurança não calculada.']
      : []),
  ].join(' ');

  return (
    <div className="min-h-screen bg-[#f1f6ff] text-[#0b1b3f]">
      <main className="mx-auto max-w-[1200px] space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <nav aria-label="Trilha de navegação" className="text-sm">
          <ol className="flex flex-wrap items-center gap-2 text-slate-600">
            <li><a className="rounded-sm hover:text-[#1d4ed8] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1d4ed8]" href={listHref}>Início</a></li>
            <li aria-hidden="true">›</li>
            <li><a className="rounded-sm hover:text-[#1d4ed8] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1d4ed8]" href={listHref}>Ações</a></li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" className="font-bold text-[#0b1b3f]">{stock.ticker}</li>
          </ol>
        </nav>

        <header className="rounded-2xl border border-[#dce6f7] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
            <div className="flex items-start gap-4">
              <StockLogo
                alt={stock.company}
                logoUrl={stock.logoUrl}
                size="large"
                ticker={stock.ticker}
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#1d4ed8]">{stock.ticker}</p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{stock.company}</h1>
                <p className="mt-1 text-sm text-slate-600">{stock.sector}</p>
                <p className="mt-3 text-2xl font-extrabold">{formatCurrency(stock.price)}</p>
                <p className="mt-1 text-xs text-slate-600">Cotação: {priceDate} (horário de Brasília)</p>
                {stock.priceFetchedAt ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Coletada em {formatTimestamp(stock.priceFetchedAt)}
                  </p>
                ) : null}
                <span
                  className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${valuationStatusStyle(stock.status)}`}
                >
                  {formatValuationStatus(stock.status)}
                </span>
                {stock.statusReasons.length > 0 ? (
                  <p className="mt-2 text-xs text-slate-600">
                    {stock.statusReasons.map(reasonLabel).join('; ')}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <a
                className="inline-flex items-center rounded-lg border border-[#dce6f7] px-4 py-2.5 text-sm font-bold text-[#1d4ed8] hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]"
                href={listHref}
              >
                Voltar para a lista
              </a>
              <button
                aria-describedby="compare-hint"
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-400"
                disabled
                title="Em breve"
                type="button"
              >
                Comparar <span aria-hidden="true">·</span> <span>em breve</span>
              </button>
              <span className="sr-only" id="compare-hint">Comparação de ações em breve.</span>
            </div>
          </div>
          {stale ? (
            <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900" role="status">
              {priceStale ? 'A cotação está desatualizada. ' : ''}
              {fundamentalsStale ? 'Os fundamentos estão desatualizados ou indisponíveis.' : ''}
            </p>
          ) : null}
        </header>

        <section aria-label="Faixa de valuation" className="grid gap-3 sm:grid-cols-3">
          <ValuationCard
            title="Preço teto"
            value={stock.ceiling}
            formula={stock.formulas.ceiling ?? 'Bazin/Barsi'}
            formulaDescription="DPA dividido por 6% · bazin-6pct-avg5y@1"
            margin={stock.ceilingMarginOfSafety}
            windowDescription={ceilingWindow}
            reason={ceilingReason || undefined}
          />
          <ValuationCard
            title="Preço justo"
            value={stock.fairPrice}
            formula={stock.formulas.fairPrice ?? 'Graham'}
            formulaDescription="Raiz de (22,5 × LPA × VPA) · graham-22.5@1"
            margin={stock.fairMarginOfSafety}
            reason={fairPriceReason || undefined}
          />
          <article className="rounded-xl border border-[#dce6f7] bg-white p-4">
            <h2 className="text-sm font-bold text-slate-600">Premissas e margem</h2>
            <p className="mt-3 text-sm leading-6">
              A margem de segurança compara o preço armazenado com cada referência calculada. Fórmulas:
              {' '}{stock.formulas.ceiling ?? 'bazin-6pct-avg5y@1'} e {stock.formulas.fairPrice ?? 'graham-22.5@1'}.
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Valores ausentes ou inválidos não são estimados; veja o motivo em cada cartão.
            </p>
          </article>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
          <div className="space-y-6">
            <MetricGroup title="Resultado">
              <MetricCard
                label="Receita"
                value={formatCompactCurrency(stock.revenue)}
                description="Receita total registrada para a companhia."
                period={resultPeriod}
                reason={stock.revenue === null ? formatMissingReason(stock.reasons.revenue) : undefined}
              />
              <MetricCard
                label="Despesas operacionais"
                value={formatCompactCurrency(stock.operatingExpenses)}
                description="Soma absoluta dos custos operacionais reportados."
                period={annualPeriod}
                reason={stock.operatingExpenses === null ? formatMissingReason(stock.reasons.operatingExpenses) : undefined}
              />
              <MetricCard
                label="Lucro líquido"
                value={formatCompactCurrency(stock.netIncome)}
                description="Resultado líquido no mesmo período da receita."
                period={resultPeriod}
                reason={stock.netIncome === null ? formatMissingReason(stock.reasons.netIncome) : undefined}
              />
              <MetricCard
                label="Margem líquida"
                value={formatPercent(stock.netMargin)}
                description="Lucro líquido dividido pela receita do período."
                period={resultPeriod}
                reason={stock.netMargin === null ? formatMissingReason(stock.reasons.netMargin) : undefined}
              />
            </MetricGroup>

            <MetricGroup title="Valuation">
              <MetricCard
                label="P/L"
                value={formatRatio(stock.pe)}
                description="Preço armazenado dividido pelo lucro por ação (LPA)."
                period={ttmPeriod}
                reason={stock.pe === null ? formatMissingReason(stock.reasons.pe) : undefined}
              />
              <MetricCard
                label="P/VP"
                value={formatRatio(stock.pb)}
                description="Preço armazenado dividido pelo valor patrimonial por ação (VPA)."
                period={ttmPeriod}
                reason={stock.pb === null ? formatMissingReason(stock.reasons.pb) : undefined}
              />
              <MetricCard
                label="Dividend yield"
                value={formatPercent(stock.dividendYield)}
                description="Proventos por ação na janela de 12 meses divididos pelo preço."
                period={ttmPeriod}
                reason={stock.dividendYield === null ? formatMissingReason(stock.reasons.dividendYield) : undefined}
              />
            </MetricGroup>

            <MetricGroup title="Rentabilidade">
              <MetricCard
                label="ROE"
                value={formatPercent(stock.roe)}
                description="Retorno sobre o patrimônio líquido."
                period={ttmPeriod}
                reason={stock.roe === null ? formatMissingReason(stock.reasons.roe) : undefined}
              />
            </MetricGroup>

            <MetricGroup title="Endividamento">
              <MetricCard
                label="Dívida líquida/EBITDA"
                value={
                  stock.financialInstitutionType !== 'none'
                    ? 'n/a'
                    : formatRatio(stock.netDebtToEbitda)
                }
                description="Dívida total menos caixa, dividida pelo EBITDA."
                period={ttmPeriod}
                reason={
                  stock.financialInstitutionType !== 'none'
                    ? 'Não aplicável a bancos e seguradoras.'
                    : stock.netDebtToEbitda === null
                      ? formatMissingReason(stock.reasons.netDebtToEbitda)
                      : undefined
                }
              />
            </MetricGroup>
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-[#dce6f7] bg-white p-5">
              <h2 className="text-lg font-extrabold">Fontes e atualização</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Origem</dt>
                  <dd className="mt-1">brapi e demonstrações financeiras públicas, armazenadas no Supabase.</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cotação</dt>
                  <dd className="mt-1">{priceDate}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fundamentos consultados</dt>
                  <dd className="mt-1">{fundamentalsDate}</dd>
                  <dd className="mt-1 text-xs text-slate-600">
                    Referências: {ttmPeriod}; {annualPeriod}.
                  </dd>
                </div>
              </dl>
              {stale ? (
                <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                  Há dados marcados como desatualizados ou sem referência disponível.
                </p>
              ) : (
                <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">
                  Os registros consultados não estão marcados como desatualizados.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-[#dce6f7] bg-white p-5">
              <h2 className="text-lg font-extrabold">Como calculamos</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                O preço teto usa Bazin/Barsi e o preço justo usa Graham. Indicadores dependentes do preço
                são calculados com a última cotação armazenada, sem persistir valores derivados.
              </p>
              <Link
                className="mt-3 inline-flex rounded-sm text-sm font-bold text-[#1d4ed8] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1d4ed8]"
                href="/#metodologia"
              >
                Ver metodologia e fontes
              </Link>
            </section>
          </aside>
        </div>
      </main>

      <footer className="border-t border-[#dce6f7] bg-white">
        <div className="mx-auto max-w-[1200px] space-y-2 px-4 py-5 text-xs leading-5 text-slate-600 sm:px-6 lg:px-10">
          <p>Conteúdo exclusivamente informativo; não constitui recomendação de investimento.</p>
          <p>Logos e marcas pertencem aos seus titulares e são usadas apenas para identificação.</p>
          <p>Fonte dos dados: brapi e demonstrações financeiras públicas das companhias.</p>
        </div>
      </footer>
    </div>
  );
}
