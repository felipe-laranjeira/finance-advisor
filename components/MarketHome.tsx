'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Clock3,
  Search,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react';
import type { MarketMetric, MarketStock } from '@/lib/market/public-stocks';
import { reasonLabel } from '@/lib/market/public-stocks';
import type { ValuationStatus } from '@/lib/valuation';

type MarketHomeProps = {
  stocks: MarketStock[];
  loadError: string | null;
};

type ColumnKey =
  | 'ticker'
  | 'company'
  | 'sector'
  | 'price'
  | 'revenue'
  | 'operatingExpenses'
  | 'netIncome'
  | 'netMargin'
  | 'pe'
  | 'pb'
  | 'dividendYield'
  | 'roe'
  | 'netDebtToEbitda'
  | 'ceiling'
  | 'fairPrice'
  | 'status';

type ColumnDefinition = {
  key: ColumnKey;
  label: string;
  shortLabel: string;
  metric?: MarketMetric;
};

const columns: ColumnDefinition[] = [
  { key: 'ticker', label: 'Ticker', shortLabel: 'Ticker' },
  { key: 'company', label: 'Empresa', shortLabel: 'Empresa' },
  { key: 'sector', label: 'Setor', shortLabel: 'Setor' },
  { key: 'price', label: 'Preço', shortLabel: 'Preço', metric: 'price' },
  { key: 'revenue', label: 'Receita', shortLabel: 'Receita', metric: 'revenue' },
  {
    key: 'operatingExpenses',
    label: 'Despesas operacionais',
    shortLabel: 'Despesas',
    metric: 'operatingExpenses',
  },
  { key: 'netIncome', label: 'Lucro líquido', shortLabel: 'Lucro', metric: 'netIncome' },
  { key: 'netMargin', label: 'Margem líquida', shortLabel: 'Margem', metric: 'netMargin' },
  { key: 'pe', label: 'P/L', shortLabel: 'P/L', metric: 'pe' },
  { key: 'pb', label: 'P/VP', shortLabel: 'P/VP', metric: 'pb' },
  {
    key: 'dividendYield',
    label: 'Dividend yield',
    shortLabel: 'Div. yield',
    metric: 'dividendYield',
  },
  { key: 'roe', label: 'ROE', shortLabel: 'ROE', metric: 'roe' },
  {
    key: 'netDebtToEbitda',
    label: 'Dívida líquida/EBITDA',
    shortLabel: 'Dívida/EBITDA',
    metric: 'netDebtToEbitda',
  },
  { key: 'ceiling', label: 'Preço teto', shortLabel: 'Preço teto', metric: 'ceiling' },
  { key: 'fairPrice', label: 'Preço justo', shortLabel: 'Preço justo', metric: 'fairPrice' },
  { key: 'status', label: 'Situação', shortLabel: 'Situação' },
];

const defaultColumns = columns.map((column) => column.key);
const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compactCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const percentage = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatCurrency(value: number | null) {
  return value === null ? '—' : currency.format(value);
}

function formatCompactCurrency(value: number | null) {
  return value === null ? '—' : compactCurrency.format(value);
}

function formatRatio(value: number | null) {
  return value === null ? '—' : decimal.format(value);
}

function formatPercent(value: number | null) {
  return value === null ? '—' : `${percentage.format(value * 100)}%`;
}

function formatTimestamp(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function formatQuarter(value: string | null) {
  if (!value || !/^\d{4}-\d{2}/.test(value)) return '—';
  const [year, month] = value.slice(0, 7).split('-').map(Number);
  return `T${Math.ceil(month / 3)}/${year}`;
}

function statusLabel(status: ValuationStatus) {
  switch (status) {
    case 'below_ceiling':
      return 'Abaixo do teto';
    case 'between_ceiling_and_fair':
      return 'Entre teto e justo';
    case 'above_fair':
      return 'Acima do justo';
    case 'not_applicable':
      return 'Não aplicável';
  }
}

function statusStyle(status: ValuationStatus) {
  switch (status) {
    case 'below_ceiling':
      return 'bg-emerald-50 text-emerald-800';
    case 'between_ceiling_and_fair':
      return 'bg-amber-50 text-amber-800';
    case 'above_fair':
      return 'bg-rose-50 text-rose-800';
    case 'not_applicable':
      return 'bg-slate-100 text-slate-700';
  }
}

function getValue(stock: MarketStock, key: ColumnKey): string | number | null {
  switch (key) {
    case 'ticker':
      return stock.ticker;
    case 'company':
      return stock.company;
    case 'sector':
      return stock.sector;
    case 'status':
      return statusLabel(stock.status);
    default:
      return stock[key];
  }
}

function getCellTitle(stock: MarketStock, column: ColumnDefinition): string | undefined {
  if (column.key === 'status') {
    if (stock.statusReasons.length > 0) {
      return stock.statusReasons.map(reasonLabel).join('; ');
    }
    return stock.formulas.ceiling && stock.formulas.fairPrice
      ? `${stock.formulas.ceiling}; ${stock.formulas.fairPrice}`
      : undefined;
  }

  if (column.key === 'ceiling') {
    const safety = formatPercent(stock.ceilingMarginOfSafety);
    const window =
      stock.ceilingWindow === 'avg_5_full_calendar_years'
        ? 'média dos cinco anos civis completos'
        : stock.ceilingWindow === 'last_12_months'
          ? 'dividendos e JCP dos últimos 12 meses'
          : 'janela indisponível';
    return [
      stock.formulas.ceiling,
      'Bazin/Barsi: DPA ÷ 6%',
      `Janela: ${window}`,
      `Margem de segurança: ${safety}`,
      ...(stock.reasons.ceiling ?? []).map(reasonLabel),
    ]
      .filter(Boolean)
      .join(' · ');
  }

  if (column.key === 'fairPrice') {
    return [
      stock.formulas.fairPrice,
      'Graham: raiz de (22,5 × LPA × VPA)',
      `Margem de segurança: ${formatPercent(stock.fairMarginOfSafety)}`,
      ...(stock.reasons.fairPrice ?? []).map(reasonLabel),
    ]
      .filter(Boolean)
      .join(' · ');
  }

  if (column.metric) {
    const formula = stock.formulas[column.metric];
    const reasons = stock.reasons[column.metric] ?? [];
    if (reasons.length > 0) return reasons.map(reasonLabel).join('; ');
    return formula;
  }

  return undefined;
}

function renderCell(stock: MarketStock, column: ColumnDefinition) {
  if (column.key === 'ticker') {
    return <span className="font-bold text-[#1d4ed8]">{stock.ticker}</span>;
  }
  if (column.key === 'company') return <span className="font-medium text-[#0b1b3f]">{stock.company}</span>;
  if (column.key === 'sector') return <span>{stock.sector}</span>;
  if (column.key === 'status') {
    return (
      <span className={`inline-flex max-w-40 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(stock.status)}`}>
        {statusLabel(stock.status)}
      </span>
    );
  }

  const value = getValue(stock, column.key);
  let formatted: string;
  switch (column.key) {
    case 'price':
    case 'ceiling':
    case 'fairPrice':
      formatted = formatCurrency(typeof value === 'number' ? value : null);
      break;
    case 'revenue':
    case 'operatingExpenses':
    case 'netIncome':
      formatted = formatCompactCurrency(typeof value === 'number' ? value : null);
      break;
    case 'netMargin':
    case 'dividendYield':
    case 'roe':
      formatted = formatPercent(typeof value === 'number' ? value : null);
      break;
    case 'pe':
    case 'pb':
    case 'netDebtToEbitda':
      formatted = formatRatio(typeof value === 'number' ? value : null);
      break;
    default:
      formatted = typeof value === 'string' ? value : '—';
  }

  return (
    <span
      className={value === null ? 'text-slate-400' : 'text-slate-700'}
      title={getCellTitle(stock, column)}
    >
      {formatted}
    </span>
  );
}

function metricValue(stock: MarketStock, key: ColumnKey): number | null {
  switch (key) {
    case 'price':
      return stock.price;
    case 'revenue':
      return stock.revenue;
    case 'operatingExpenses':
      return stock.operatingExpenses;
    case 'netIncome':
      return stock.netIncome;
    case 'netMargin':
      return stock.netMargin;
    case 'pe':
      return stock.pe;
    case 'pb':
      return stock.pb;
    case 'dividendYield':
      return stock.dividendYield;
    case 'roe':
      return stock.roe;
    case 'netDebtToEbitda':
      return stock.netDebtToEbitda;
    case 'ceiling':
      return stock.ceiling;
    case 'fairPrice':
      return stock.fairPrice;
    default:
      return null;
  }
}

function compareStocks(
  first: MarketStock,
  second: MarketStock,
  key: ColumnKey,
  direction: 'asc' | 'desc',
) {
  const firstMetric = metricValue(first, key);
  const secondMetric = metricValue(second, key);
  if (firstMetric === null && secondMetric !== null) return 1;
  if (secondMetric === null && firstMetric !== null) return -1;

  const firstValue = getValue(first, key);
  const secondValue = getValue(second, key);
  const comparison =
    typeof firstValue === 'number' && typeof secondValue === 'number'
      ? firstValue - secondValue
      : String(firstValue ?? '').localeCompare(String(secondValue ?? ''), 'pt-BR');
  return comparison * (direction === 'asc' ? 1 : -1);
}

function MarketHome({ stocks, loadError }: MarketHomeProps) {
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('Todos os setores');
  const [yieldFilter, setYieldFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [sortKey, setSortKey] = useState<ColumnKey>('ticker');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(defaultColumns);
  const [columnsOpen, setColumnsOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('market-home-columns');
      if (!saved) return;
      const parsed: unknown = JSON.parse(saved);
      if (
        Array.isArray(parsed) &&
        parsed.every((key): key is ColumnKey => columns.some((column) => column.key === key)) &&
        parsed.includes('ticker')
      ) {
        setVisibleColumns(parsed);
      }
    } catch (error) {
      console.error('Não foi possível carregar as colunas salvas.', error);
    }
  }, []);

  const sectors = useMemo(
    () => ['Todos os setores', ...new Set(stocks.map((stock) => stock.sector))],
    [stocks],
  );

  const filteredStocks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');

    return stocks
      .filter((stock) => {
        const matchesQuery =
          !normalizedQuery ||
          stock.ticker.toLocaleLowerCase('pt-BR').includes(normalizedQuery) ||
          stock.company.toLocaleLowerCase('pt-BR').includes(normalizedQuery);
        const matchesSector = sector === 'Todos os setores' || stock.sector === sector;
        const matchesYield =
          yieldFilter === 'Todos' ||
          (yieldFilter === 'Acima de 5%' && stock.dividendYield !== null && stock.dividendYield >= 0.05) ||
          (yieldFilter === 'Acima de 8%' && stock.dividendYield !== null && stock.dividendYield >= 0.08);
        const matchesStatus =
          statusFilter === 'Todas' || statusLabel(stock.status) === statusFilter;
        return matchesQuery && matchesSector && matchesYield && matchesStatus;
      })
      .sort((first, second) => compareStocks(first, second, sortKey, sortDirection));
  }, [query, sector, yieldFilter, statusFilter, sortKey, sortDirection, stocks]);

  const latestQuote = stocks
    .map((stock) => stock.quoteAt)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1) ?? null;
  const latestQuoteUpdate = stocks
    .map((stock) => stock.priceFetchedAt)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1) ?? null;
  const latestTtmPeriod = stocks
    .map((stock) => stock.ttmPeriodEnd)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1) ?? null;
  const latestAnnualPeriod = stocks
    .map((stock) => stock.annualPeriodEnd)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1) ?? null;
  const hasStalePrices = stocks.some((stock) => stock.priceIsStale);
  const hasStaleFundamentals = stocks.some((stock) => stock.fundamentalsAreStale);
  const availableQuoteCount = stocks.filter((stock) => stock.price !== null).length;

  function toggleColumn(key: ColumnKey) {
    setVisibleColumns((current) => {
      const next = current.includes(key)
        ? current.filter((column) => column !== key)
        : [...current, key];
      try {
        window.localStorage.setItem('market-home-columns', JSON.stringify(next));
      } catch (error) {
        console.error('Não foi possível salvar as colunas escolhidas.', error);
      }
      return next;
    });
  }

  function sortBy(key: ColumnKey) {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  }

  function clearFilters() {
    setQuery('');
    setSector('Todos os setores');
    setYieldFilter('Todos');
    setStatusFilter('Todas');
  }

  return (
    <div className="-mb-20 min-h-screen bg-[#f1f6ff] text-[#0b1b3f] lg:mb-0">
      <header className="sticky top-0 z-30 border-b border-[#dce6f7] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Financial Advisor, página inicial">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1d4ed8] text-white">
              <TrendingUp size={21} aria-hidden="true" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">Financial Advisor</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#1d4ed8] sm:inline-flex">
              Mercado B3
            </span>
            <Link
              href="/entrar"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-[#1d4ed8] transition hover:bg-blue-50"
            >
              Entrar
            </Link>
            <Link
              href="/registrar"
              className="rounded-lg bg-[#1d4ed8] px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <span className="sm:hidden">Registrar</span>
              <span className="hidden sm:inline">Registrar conta</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-[1440px] px-4 pb-8 pt-10 sm:px-6 lg:px-10 lg:pt-14">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#1d4ed8]">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              Mercado brasileiro
            </p>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[42px]">
              Indicadores fundamentalistas da B3
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Consulte dados armazenados e fórmulas transparentes. Valores ausentes ou não aplicáveis
              aparecem como traço, com o motivo disponível ao passar o cursor.
            </p>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#dce6f7] bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ações acompanhadas</p>
              <p className="mt-2 text-2xl font-extrabold">
                {stocks.length} <span className="text-sm font-medium text-slate-500">ações</span>
              </p>
            </div>
            <div className="rounded-2xl border border-[#dce6f7] bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cotações disponíveis</p>
              <p className="mt-2 text-2xl font-extrabold">
                {availableQuoteCount} <span className="text-sm font-medium text-slate-500">de {stocks.length}</span>
              </p>
            </div>
            <div className="rounded-2xl border border-[#dce6f7] bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Última atualização de preço</p>
              <p className="mt-2 inline-flex items-center gap-2 text-base font-bold">
                <Clock3 size={17} className={hasStalePrices ? 'text-amber-600' : 'text-emerald-600'} aria-hidden="true" />
                {formatTimestamp(latestQuoteUpdate)}
              </p>
            </div>
          </div>

          {loadError ? (
            <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-900" role="alert">
              {loadError}
            </div>
          ) : null}
          {hasStaleFundamentals ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-950" role="status">
              Alguns fundamentos estão desatualizados ou não foram fornecidos pela brapi. O último dado válido foi preservado.
            </div>
          ) : null}
          {hasStalePrices ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-950" role="status">
              Algumas cotações não foram atualizadas na última coleta.
            </div>
          ) : null}
        </section>

        <section id="acoes" className="mx-auto max-w-[1440px] scroll-mt-24 px-4 pb-12 sm:px-6 lg:px-10">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#1d4ed8]">Universo B3</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-[28px]">Ações em destaque</h2>
              <p className="mt-1 text-sm text-slate-600">
                Preços e fundamentos lidos do Supabase; indicadores derivados no servidor.
              </p>
            </div>
            <p className="text-xs text-slate-500">
              Última atualização das cotações: {formatTimestamp(latestQuoteUpdate)}
            </p>
          </div>

          <div className="rounded-2xl border border-[#dce6f7] bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1.6fr)_repeat(3,minmax(140px,1fr))_auto]">
              <label className="relative block">
                <span className="sr-only">Buscar por ticker ou nome da empresa</span>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                <input
                  className="h-11 w-full rounded-lg border border-[#dce6f7] bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1d4ed8] focus:ring-2 focus:ring-blue-100"
                  placeholder="Buscar ticker ou empresa"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label>
                <span className="sr-only">Filtrar por setor</span>
                <select
                  className="h-11 w-full rounded-lg border border-[#dce6f7] bg-white px-3 text-sm outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-blue-100"
                  value={sector}
                  onChange={(event) => setSector(event.target.value)}
                >
                  {sectors.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">Filtrar por dividend yield</span>
                <select
                  className="h-11 w-full rounded-lg border border-[#dce6f7] bg-white px-3 text-sm outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-blue-100"
                  value={yieldFilter}
                  onChange={(event) => setYieldFilter(event.target.value)}
                >
                  <option>Todos</option><option>Acima de 5%</option><option>Acima de 8%</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Filtrar por situação</span>
                <select
                  className="h-11 w-full rounded-lg border border-[#dce6f7] bg-white px-3 text-sm outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-blue-100"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option>Todas</option>
                  <option>Abaixo do teto</option>
                  <option>Entre teto e justo</option>
                  <option>Acima do justo</option>
                  <option>Não aplicável</option>
                </select>
              </label>
              <div className="relative">
                <button
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#dce6f7] px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 lg:w-auto"
                  type="button"
                  aria-expanded={columnsOpen}
                  onClick={() => setColumnsOpen((open) => !open)}
                >
                  <SlidersHorizontal size={16} aria-hidden="true" /> Colunas
                </button>
                {columnsOpen ? (
                  <div className="absolute right-0 top-12 z-20 max-h-80 w-60 overflow-y-auto rounded-xl border border-[#dce6f7] bg-white p-2 shadow-xl">
                    {columns.map((column) => (
                      <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-blue-50">
                        <input
                          className="accent-[#1d4ed8]"
                          type="checkbox"
                          checked={visibleColumns.includes(column.key)}
                          disabled={column.key === 'ticker'}
                          onChange={() => toggleColumn(column.key)}
                        />
                        {column.label}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {filteredStocks.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-[#dce6f7] bg-[#f8faff] px-5 py-10 text-center">
                <p className="text-sm font-semibold">
                  {loadError ? 'Os dados ainda não puderam ser carregados.' : 'Nenhuma ação corresponde aos filtros.'}
                </p>
                {!loadError ? (
                  <button className="mt-2 text-sm font-bold text-[#1d4ed8] hover:underline" type="button" onClick={clearFilters}>
                    Limpar filtros
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <div className="mt-5 hidden overflow-x-auto lg:block">
                  <table className="min-w-full text-left text-sm">
                    <caption className="sr-only">Indicadores fundamentalistas das ações configuradas</caption>
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wide text-slate-500">
                        {columns.filter((column) => visibleColumns.includes(column.key)).map((column) => (
                          <th
                            key={column.key}
                            className={`whitespace-nowrap px-3 py-3 ${column.key === 'ticker' ? 'sticky left-0 z-[2] bg-white' : ''}`}
                            scope="col"
                          >
                            <button
                              className="inline-flex items-center gap-1.5 hover:text-[#1d4ed8]"
                              type="button"
                              aria-label={`Ordenar por ${column.label}`}
                              onClick={() => sortBy(column.key)}
                            >
                              {column.label}
                              {sortKey === column.key ? (
                                sortDirection === 'asc'
                                  ? <ArrowUp size={13} aria-hidden="true" />
                                  : <ArrowDown size={13} aria-hidden="true" />
                              ) : (
                                <ArrowDownUp size={13} className="opacity-35" aria-hidden="true" />
                              )}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStocks.map((stock) => (
                        <tr className="transition hover:bg-blue-50/50" key={stock.ticker}>
                          {columns.filter((column) => visibleColumns.includes(column.key)).map((column) => (
                            <td
                              key={column.key}
                              className={`whitespace-nowrap px-3 py-3.5 ${column.key === 'ticker' ? 'sticky left-0 z-[1] bg-white font-semibold' : ''}`}
                              title={getCellTitle(stock, column)}
                            >
                              {renderCell(stock, column)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="mt-4 grid gap-3 lg:hidden">
                  {filteredStocks.map((stock) => (
                    <li key={stock.ticker} className="rounded-xl border border-[#e7eef9] bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-extrabold text-[#1d4ed8]">{stock.ticker}</p>
                          <p className="mt-0.5 text-sm font-medium">{stock.company}</p>
                          <p className="text-xs text-slate-500">{stock.sector}</p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle(stock.status)}`}
                          title={stock.statusReasons.map(reasonLabel).join('; ')}
                        >
                          {statusLabel(stock.status)}
                        </span>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-100 py-3 text-sm">
                        {columns
                          .filter((column) =>
                            visibleColumns.includes(column.key) &&
                            !['ticker', 'company', 'sector', 'status'].includes(column.key),
                          )
                          .map((column) => (
                            <div key={column.key} title={getCellTitle(stock, column)}>
                              <dt className="text-xs text-slate-500">{column.shortLabel}</dt>
                              <dd className="mt-0.5 font-semibold">{renderCell(stock, column)}</dd>
                            </div>
                          ))}
                      </dl>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-4 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
              {latestQuote
                ? `Preços de ${formatDate(latestQuote)}; fundamentos TTM até ${formatQuarter(latestTtmPeriod)}; DRE anual até ${formatDate(latestAnnualPeriod)}.`
                : 'Ainda não há cotações disponíveis.'}
              {' '}Última coleta de preços: {formatTimestamp(latestQuoteUpdate)}.
              {hasStalePrices || hasStaleFundamentals
                ? ' Há dados desatualizados; consulte os avisos acima.'
                : ''}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Margem líquida usa receita e lucro do mesmo período anual consolidado. P/L, P/VP e dividend yield
              usam o preço armazenado. Fundamentos TTM e anuais estão identificados nos respectivos períodos.
            </p>
          </div>
        </section>

        <section id="metodologia" className="mx-auto max-w-[1440px] px-4 pb-10 sm:px-6 lg:px-10">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:p-7">
            <h2 className="text-lg font-extrabold">Metodologia e fontes</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
              O preço teto usa Bazin/Barsi (DPA ÷ 6%); a média considera cinco anos civis completos e,
              com histórico menor que três anos, usa a janela de 12 meses, sempre identificada. O preço
              justo usa Graham (raiz de 22,5 × LPA × VPA). Prejuízo, ausência de proventos e dados
              indisponíveis não são substituídos por estimativas.
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-600">
              Fontes: brapi e demonstrações financeiras públicas das companhias. Bancos e seguradoras
              não recebem indicadores de dívida líquida/EBITDA ou despesas operacionais incompatíveis.
            </p>
            <p className="mt-3 text-sm font-semibold text-[#0b1b3f]">
              Conteúdo exclusivamente informativo; não constitui recomendação de compra ou venda.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dce6f7] bg-white">
        <div className="mx-auto max-w-[1440px] px-4 py-5 text-xs leading-5 text-slate-500 sm:px-6 lg:px-10">
          Dados e fórmulas para fins educacionais. Fontes: brapi e dados públicos das empresas. Não é
          recomendação de investimento.
        </div>
      </footer>
    </div>
  );
}

export default MarketHome;
