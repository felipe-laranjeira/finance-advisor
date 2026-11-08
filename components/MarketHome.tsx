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
import type { MarketStock } from '@/lib/market/public-stocks';
import { reasonLabel } from '@/lib/market/public-stocks';
import StockLogo from '@/components/StockLogo';
import {
  formatDate,
  formatPercent,
  formatQuarter,
  formatTimestamp,
  formatValuationStatus as statusLabel,
  valuationStatusStyle as statusStyle,
} from '@/lib/market/format';
import {
  compareMarketColumnValues,
  DEFAULT_MARKET_COLUMNS,
  isDefaultMarketColumnSelection,
  MARKET_COLUMNS,
  migrateLegacyColumnPreference,
  type MarketColumnDefinition,
  type MarketColumnId,
} from '@/lib/market/columns';

type MarketHomeProps = {
  stocks: MarketStock[];
  loadError: string | null;
  initialListState: {
    query: string;
    sector: string;
    yieldFilter: string;
    statusFilter: string;
    sortKey: MarketColumnId;
    sortDirection: 'asc' | 'desc';
    visibleColumns: MarketColumnId[];
  };
};

const columns = MARKET_COLUMNS;

function getCellTitle(stock: MarketStock, column: MarketColumnDefinition): string | undefined {
  if (column.id === 'status') {
    if (stock.statusReasons.length > 0) {
      return stock.statusReasons.map(reasonLabel).join('; ');
    }
    return stock.formulas.ceiling && stock.formulas.fairPrice
      ? `${stock.formulas.ceiling}; ${stock.formulas.fairPrice}`
      : undefined;
  }

  if (column.id === 'ceiling') {
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

  if (column.id === 'fairPrice') {
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

function renderCell(stock: MarketStock, column: MarketColumnDefinition, detailHref: string) {
  if (column.id === 'ticker') {
    return (
      <a
        className="inline-flex items-center gap-2 rounded-sm font-bold text-[#1d4ed8] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]"
        href={detailHref}
        aria-label={`Ver análise de ${stock.ticker}, ${stock.company}`}
      >
        <StockLogo logoUrl={stock.logoUrl} ticker={stock.ticker} />
        {stock.ticker}
      </a>
    );
  }
  if (column.id === 'company') return <span className="font-medium text-[#0b1b3f]">{stock.company}</span>;
  if (column.id === 'status') {
    return (
      <span className={`inline-flex max-w-40 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(stock.status)}`}>
        {statusLabel(stock.status)}
      </span>
    );
  }

  const value = column.getValue(stock);
  const formatted = column.format(value);

  return (
    <span
      className={value === null ? 'text-slate-400' : 'text-slate-700'}
      title={getCellTitle(stock, column)}
    >
      {formatted}
    </span>
  );
}

function compareStocks(
  first: MarketStock,
  second: MarketStock,
  key: MarketColumnId,
  direction: 'asc' | 'desc',
) {
  const column = columns.find((item) => item.id === key);
  if (!column) return 0;
  return compareMarketColumnValues(
    column.getValue(first),
    column.getValue(second),
    direction,
  );
}

function MarketHome({ stocks, loadError, initialListState }: MarketHomeProps) {
  const [query, setQuery] = useState(initialListState.query);
  const [sector, setSector] = useState(initialListState.sector);
  const [yieldFilter, setYieldFilter] = useState(initialListState.yieldFilter);
  const [statusFilter, setStatusFilter] = useState(initialListState.statusFilter);
  const [sortKey, setSortKey] = useState<MarketColumnId>(initialListState.sortKey);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialListState.sortDirection);
  const [visibleColumns, setVisibleColumns] = useState<MarketColumnId[]>(
    initialListState.visibleColumns,
  );
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [helpColumn, setHelpColumn] = useState<MarketColumnId | null>(null);
  const [listStateReady, setListStateReady] = useState(false);

  useEffect(() => {
    try {
      migrateLegacyColumnPreference(window.localStorage);
    } catch (error) {
      console.error('Não foi possível migrar a preferência local de colunas.', error);
    } finally {
      setListStateReady(true);
    }
  }, []);

  const listQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (sector !== 'Todos os setores') params.set('sector', sector);
    if (yieldFilter !== 'Todos') params.set('yield', yieldFilter);
    if (statusFilter !== 'Todas') params.set('status', statusFilter);
    if (sortKey !== 'ticker') params.set('sort', sortKey);
    if (sortDirection !== 'asc') params.set('direction', sortDirection);
    if (!isDefaultMarketColumnSelection(visibleColumns)) {
      params.set('cols', visibleColumns.join(','));
    }
    return params.toString();
  }, [query, sector, yieldFilter, statusFilter, sortKey, sortDirection, visibleColumns]);

  useEffect(() => {
    if (!listStateReady) return;
    const nextUrl = `${window.location.pathname}${listQuery ? `?${listQuery}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [listQuery, listStateReady]);

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

  function toggleColumn(key: MarketColumnId) {
    if (key === 'ticker' || key === 'status') return;
    setVisibleColumns((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return columns
        .filter((column) => next.has(column.id))
        .map((column) => column.id);
    });
  }

  function detailHref(ticker: string) {
    return `/acoes/${ticker}${listQuery ? `?${listQuery}` : ''}`;
  }

  function sortBy(key: MarketColumnId) {
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

  const visibleColumnDefinitions = columns.filter((column) =>
    visibleColumns.includes(column.id),
  );
  const mobilePrimaryColumns = columns
    .filter((column) =>
      column.mobilePriority !== null &&
      !['ticker', 'company', 'status'].includes(column.id),
    )
    .sort((first, second) =>
      (first.mobilePriority ?? Number.MAX_SAFE_INTEGER) -
      (second.mobilePriority ?? Number.MAX_SAFE_INTEGER),
    );
  const mobileOptionalColumns = columns.filter((column) =>
    column.optional && visibleColumns.includes(column.id),
  );
  const visibleColumnWidthTotal = visibleColumnDefinitions.reduce(
    (total, column) => total + column.width,
    0,
  );
  const hasManyOptionalColumns = mobileOptionalColumns.length >= 3;
  const tableWidthBasis = hasManyOptionalColumns
    ? Math.max(1400, visibleColumnWidthTotal)
    : visibleColumnWidthTotal;
  const statusColumn = columns.find((column) => column.id === 'status');

  return (
    <div
      className="-mb-20 min-h-screen bg-[#f1f6ff] text-[#0b1b3f] lg:mb-0"
      data-market-home-ready={listStateReady ? 'true' : 'false'}
    >
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
              aparecem como traço, com o motivo disponível nas dicas acessíveis.
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
            <p className="text-xs text-slate-600">
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
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#dce6f7] px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8] lg:w-auto"
                  type="button"
                  aria-controls="market-column-options"
                  aria-expanded={columnsOpen}
                  onClick={() => setColumnsOpen((open) => !open)}
                >
                  <SlidersHorizontal size={16} aria-hidden="true" /> Colunas
                </button>
                {columnsOpen ? (
                  <div
                    id="market-column-options"
                    role="group"
                    aria-label="Colunas visíveis"
                    className="absolute right-0 top-12 z-20 max-h-80 w-64 overflow-y-auto rounded-xl border border-[#dce6f7] bg-white p-2 shadow-xl"
                  >
                    <button
                      className="mb-1 w-full rounded-lg px-2 py-2 text-left text-sm font-semibold text-[#1d4ed8] hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1d4ed8] disabled:cursor-not-allowed disabled:text-slate-400"
                      type="button"
                      disabled={isDefaultMarketColumnSelection(visibleColumns)}
                      onClick={() => setVisibleColumns([...DEFAULT_MARKET_COLUMNS])}
                    >
                      Restaurar padrão
                    </button>
                    {columns.map((column) => (
                      <label
                        key={column.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-blue-50"
                      >
                        <input
                          className="accent-[#1d4ed8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]"
                          type="checkbox"
                          checked={visibleColumns.includes(column.id)}
                          disabled={column.id === 'ticker' || column.id === 'status'}
                          onChange={() => toggleColumn(column.id)}
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
                  <table
                    className={`w-full table-fixed text-sm ${
                      hasManyOptionalColumns ? 'min-w-[1400px]' : ''
                    }`}
                  >
                    <caption className="sr-only">Indicadores fundamentalistas das ações configuradas</caption>
                    <colgroup>
                      {visibleColumnDefinitions.map((column) => (
                        <col
                          key={column.id}
                          style={{ width: `${(column.width / tableWidthBasis) * 100}%` }}
                        />
                      ))}
                    </colgroup>
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wide text-slate-500">
                        {visibleColumnDefinitions.map((column) => (
                          <th
                            key={column.id}
                            aria-sort={
                              sortKey === column.id
                                ? sortDirection === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                            className={`px-2 py-3 ${
                              column.alignment === 'right' ? 'text-right' : 'text-left'
                            } ${
                              column.id === 'ticker'
                                ? 'sticky left-0 z-[2] bg-white'
                                : ''
                            } ${
                              ['ceiling', 'fairPrice', 'status'].includes(column.id)
                                ? 'bg-blue-50 font-extrabold text-[#0b1b3f]'
                                : ''
                            }`}
                            scope="col"
                          >
                            <div
                              className={`flex items-center gap-1 ${
                                column.alignment === 'right' ? 'justify-end' : ''
                              }`}
                            >
                              <button
                                className="inline-flex items-center gap-1 rounded-sm text-left hover:text-[#1d4ed8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]"
                                type="button"
                                aria-label={`Ordenar por ${column.label}`}
                                onClick={() => sortBy(column.id)}
                              >
                                <span>{column.label}</span>
                                {sortKey === column.id ? (
                                  sortDirection === 'asc'
                                    ? <ArrowUp size={13} aria-hidden="true" />
                                    : <ArrowDown size={13} aria-hidden="true" />
                                ) : (
                                  <ArrowDownUp size={13} className="shrink-0 opacity-35" aria-hidden="true" />
                                )}
                              </button>
                              <div className="relative shrink-0 text-left normal-case tracking-normal">
                                <button
                                  className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-bold text-slate-600 hover:border-[#1d4ed8] hover:text-[#1d4ed8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]"
                                  type="button"
                                  aria-label={`Sobre ${column.label}`}
                                  aria-expanded={helpColumn === column.id}
                                  aria-controls={
                                    helpColumn === column.id
                                      ? `market-column-help-${column.id}`
                                      : undefined
                                  }
                                  aria-describedby={
                                    helpColumn === column.id
                                      ? `market-column-help-${column.id}`
                                      : undefined
                                  }
                                  onClick={() =>
                                    setHelpColumn((current) =>
                                      current === column.id ? null : column.id,
                                    )
                                  }
                                >
                                  i
                                </button>
                                {helpColumn === column.id ? (
                                  <span
                                    id={`market-column-help-${column.id}`}
                                    className="absolute right-0 top-6 z-20 w-56 rounded-lg border border-[#dce6f7] bg-white p-3 text-xs font-medium normal-case leading-5 text-[#0b1b3f] shadow-lg"
                                    role="tooltip"
                                  >
                                    {column.description}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStocks.map((stock) => (
                        <tr className="transition hover:bg-blue-50/50" key={stock.ticker}>
                          {visibleColumnDefinitions.map((column) => (
                            <td
                              key={column.id}
                              className={`break-words px-2 py-3.5 ${
                                column.alignment === 'right' ? 'text-right tabular-nums' : 'text-left'
                              } ${
                                column.id === 'ticker'
                                  ? 'sticky left-0 z-[1] bg-white font-semibold'
                                  : ''
                              } ${
                                ['ceiling', 'fairPrice', 'status'].includes(column.id)
                                  ? 'bg-blue-50/50 font-semibold'
                                  : ''
                              }`}
                              title={getCellTitle(stock, column)}
                            >
                              {renderCell(stock, column, detailHref(stock.ticker))}
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
                          <a
                            href={detailHref(stock.ticker)}
                            className="inline-flex items-center gap-2 rounded-sm font-extrabold text-[#1d4ed8] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]"
                            aria-label={`Ver análise de ${stock.ticker}, ${stock.company}`}
                          >
                            <StockLogo logoUrl={stock.logoUrl} ticker={stock.ticker} />
                            {stock.ticker}
                          </a>
                          <p className="mt-0.5 text-sm font-medium">{stock.company}</p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle(stock.status)}`}
                          title={statusColumn ? getCellTitle(stock, statusColumn) : undefined}
                        >
                          {statusLabel(stock.status)}
                        </span>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-100 py-3 text-sm">
                        {mobilePrimaryColumns.map((column) => (
                          <div key={column.id} title={getCellTitle(stock, column)}>
                            <dt className="text-xs text-slate-500">{column.shortLabel}</dt>
                            <dd
                              className={`mt-0.5 font-semibold ${
                                column.alignment === 'right' ? 'tabular-nums' : ''
                              }`}
                            >
                              {column.format(column.getValue(stock))}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      {mobileOptionalColumns.length > 0 ? (
                        <details className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                          <summary className="cursor-pointer rounded-sm text-sm font-semibold text-[#1d4ed8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]">
                            Outras colunas selecionadas ({mobileOptionalColumns.length})
                          </summary>
                          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                            {mobileOptionalColumns.map((column) => (
                              <div key={column.id} title={getCellTitle(stock, column)}>
                                <dt className="text-xs text-slate-500">{column.shortLabel}</dt>
                                <dd
                                  className={`mt-0.5 font-semibold ${
                                    column.alignment === 'right' ? 'tabular-nums' : ''
                                  }`}
                                >
                                  {column.format(column.getValue(stock))}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      ) : null}
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
