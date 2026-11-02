'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  BarChart3,
  Check,
  ChevronDown,
  Clock3,
  Search,
  SlidersHorizontal,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type MarketStock = {
  ticker: string;
  company: string;
  sector: string;
  priceCents: number | null;
  changeBps: number | null;
  quoteAt?: string | null;
  fetchedAt?: string | null;
  isStale?: boolean;
  revenueCents: number;
  profitCents: number;
  marginBps: number;
  peHundredths: number | null;
  pbHundredths: number | null;
  dividendYieldBps: number;
  roeBps: number;
  netDebtEbitdaHundredths: number | null;
  ceilingCents: number | null;
  fairValueCents: number | null;
  status: 'Abaixo do teto' | 'Entre teto e justo' | 'Acima do justo' | 'Fórmula não se aplica';
};

type ColumnKey = keyof Omit<MarketStock, 'quoteAt' | 'fetchedAt' | 'isStale'>;

export type MarketQuote = {
  ticker: string;
  price: number;
  quoteAt: string | null;
  fetchedAt: string;
  isStale: boolean;
};

type MarketHomeProps = {
  quotes: MarketQuote[];
  quoteError: string | null;
};

const illustrativeStocks: MarketStock[] = [
  {
    ticker: 'PETR4',
    company: 'Petrobras PN',
    sector: 'Petróleo e gás',
    priceCents: 3692,
    changeBps: 113,
    revenueCents: 49740000000000,
    profitCents: 12460000000000,
    marginBps: 2505,
    peHundredths: 420,
    pbHundredths: 119,
    dividendYieldBps: 1030,
    roeBps: 3020,
    netDebtEbitdaHundredths: 75,
    ceilingCents: 4210,
    fairValueCents: 5180,
    status: 'Abaixo do teto',
  },
  {
    ticker: 'VALE3',
    company: 'Vale ON',
    sector: 'Materiais básicos',
    priceCents: 5890,
    changeBps: -68,
    revenueCents: 20680000000000,
    profitCents: 3900000000000,
    marginBps: 1887,
    peHundredths: 650,
    pbHundredths: 148,
    dividendYieldBps: 810,
    roeBps: 2310,
    netDebtEbitdaHundredths: 92,
    ceilingCents: 6470,
    fairValueCents: 7210,
    status: 'Abaixo do teto',
  },
  {
    ticker: 'ITUB4',
    company: 'Itaú Unibanco PN',
    sector: 'Financeiro',
    priceCents: 3554,
    changeBps: 42,
    revenueCents: 13120000000000,
    profitCents: 4100000000000,
    marginBps: 3125,
    peHundredths: 890,
    pbHundredths: 198,
    dividendYieldBps: 650,
    roeBps: 2240,
    netDebtEbitdaHundredths: null,
    ceilingCents: null,
    fairValueCents: null,
    status: 'Fórmula não se aplica',
  },
  {
    ticker: 'BBDC4',
    company: 'Bradesco PN',
    sector: 'Financeiro',
    priceCents: 1548,
    changeBps: 91,
    revenueCents: 10350000000000,
    profitCents: 1700000000000,
    marginBps: 1643,
    peHundredths: 970,
    pbHundredths: 91,
    dividendYieldBps: 520,
    roeBps: 970,
    netDebtEbitdaHundredths: null,
    ceilingCents: null,
    fairValueCents: null,
    status: 'Fórmula não se aplica',
  },
  {
    ticker: 'BBAS3',
    company: 'Banco do Brasil ON',
    sector: 'Financeiro',
    priceCents: 2840,
    changeBps: -35,
    revenueCents: 11240000000000,
    profitCents: 3700000000000,
    marginBps: 3292,
    peHundredths: 480,
    pbHundredths: 86,
    dividendYieldBps: 980,
    roeBps: 1870,
    netDebtEbitdaHundredths: null,
    ceilingCents: null,
    fairValueCents: null,
    status: 'Fórmula não se aplica',
  },
  {
    ticker: 'ABEV3',
    company: 'Ambev ON',
    sector: 'Consumo não cíclico',
    priceCents: 1287,
    changeBps: 27,
    revenueCents: 7980000000000,
    profitCents: 1450000000000,
    marginBps: 1817,
    peHundredths: 1450,
    pbHundredths: 231,
    dividendYieldBps: 570,
    roeBps: 1590,
    netDebtEbitdaHundredths: -42,
    ceilingCents: 1190,
    fairValueCents: 1530,
    status: 'Entre teto e justo',
  },
  {
    ticker: 'WEGE3',
    company: 'WEG ON',
    sector: 'Bens industriais',
    priceCents: 5270,
    changeBps: 156,
    revenueCents: 3830000000000,
    profitCents: 620000000000,
    marginBps: 1619,
    peHundredths: 3210,
    pbHundredths: 940,
    dividendYieldBps: 130,
    roeBps: 2930,
    netDebtEbitdaHundredths: -210,
    ceilingCents: 970,
    fairValueCents: 3420,
    status: 'Acima do justo',
  },
  {
    ticker: 'B3SA3',
    company: 'B3 ON',
    sector: 'Financeiro',
    priceCents: 1235,
    changeBps: 64,
    revenueCents: 1020000000000,
    profitCents: 510000000000,
    marginBps: 5000,
    peHundredths: 1520,
    pbHundredths: 290,
    dividendYieldBps: 480,
    roeBps: 1940,
    netDebtEbitdaHundredths: -180,
    ceilingCents: null,
    fairValueCents: null,
    status: 'Fórmula não se aplica',
  },
  {
    ticker: 'RENT3',
    company: 'Localiza ON',
    sector: 'Consumo cíclico',
    priceCents: 4580,
    changeBps: -112,
    revenueCents: 3640000000000,
    profitCents: 370000000000,
    marginBps: 1016,
    peHundredths: 2030,
    pbHundredths: 236,
    dividendYieldBps: 190,
    roeBps: 1260,
    netDebtEbitdaHundredths: 278,
    ceilingCents: 520,
    fairValueCents: 3980,
    status: 'Acima do justo',
  },
  {
    ticker: 'SUZB3',
    company: 'Suzano ON',
    sector: 'Materiais básicos',
    priceCents: 5360,
    changeBps: 83,
    revenueCents: 4480000000000,
    profitCents: 810000000000,
    marginBps: 1808,
    peHundredths: 870,
    pbHundredths: 102,
    dividendYieldBps: 340,
    roeBps: 1170,
    netDebtEbitdaHundredths: 225,
    ceilingCents: 1120,
    fairValueCents: 4810,
    status: 'Acima do justo',
  },
];

const columns: { key: ColumnKey; label: string; shortLabel: string }[] = [
  { key: 'ticker', label: 'Ticker', shortLabel: 'Ticker' },
  { key: 'company', label: 'Empresa', shortLabel: 'Empresa' },
  { key: 'priceCents', label: 'Preço', shortLabel: 'Preço' },
  { key: 'revenueCents', label: 'Receita', shortLabel: 'Receita' },
  { key: 'profitCents', label: 'Lucro líquido', shortLabel: 'Lucro' },
  { key: 'marginBps', label: 'Margem líquida', shortLabel: 'Margem' },
  { key: 'peHundredths', label: 'P/L', shortLabel: 'P/L' },
  { key: 'pbHundredths', label: 'P/VP', shortLabel: 'P/VP' },
  { key: 'dividendYieldBps', label: 'Dividend yield', shortLabel: 'Div. yield' },
  { key: 'roeBps', label: 'ROE', shortLabel: 'ROE' },
  { key: 'netDebtEbitdaHundredths', label: 'Dívida líquida/EBITDA', shortLabel: 'Dívida/EBITDA' },
  { key: 'ceilingCents', label: 'Preço teto', shortLabel: 'Preço teto' },
  { key: 'fairValueCents', label: 'Preço justo', shortLabel: 'Preço justo' },
  { key: 'status', label: 'Situação', shortLabel: 'Situação' },
];

const defaultColumns: ColumnKey[] = [
  'ticker',
  'company',
  'priceCents',
  'revenueCents',
  'profitCents',
  'marginBps',
  'peHundredths',
  'pbHundredths',
  'dividendYieldBps',
  'roeBps',
  'ceilingCents',
  'fairValueCents',
  'status',
];

const financialHistory = [
  { year: '2021', revenue: 340, profit: 57 },
  { year: '2022', revenue: 420, profit: 78 },
  { year: '2023', revenue: 510, profit: 103 },
  { year: '2024', revenue: 470, profit: 92 },
  { year: '2025', revenue: 497, profit: 125 },
];

const quoteHistory = [
  { month: 'Mai', PETR4: 31, VALE3: 62, ITUB4: 33 },
  { month: 'Jun', PETR4: 33, VALE3: 59, ITUB4: 34 },
  { month: 'Jul', PETR4: 32, VALE3: 63, ITUB4: 33 },
  { month: 'Ago', PETR4: 35, VALE3: 61, ITUB4: 35 },
  { month: 'Set', PETR4: 34, VALE3: 57, ITUB4: 36 },
  { month: 'Out', PETR4: 37, VALE3: 59, ITUB4: 36 },
];

const performanceSeries = [
  [100, 106, 103, 112, 109, 119],
  [100, 96, 105, 98, 94, 97],
  [100, 102, 105, 108, 108, 115],
  [100, 99, 104, 101, 110, 107],
];

const dividendHistory = [
  { year: '2021', dividends: 2.4 },
  { year: '2022', dividends: 6.1 },
  { year: '2023', dividends: 5.2 },
  { year: '2024', dividends: 3.8 },
  { year: '2025', dividends: 4.5 },
];

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

function formatPrice(cents: number | null) {
  return cents === null ? '—' : brl.format(cents / 100);
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function formatBillions(cents: number) {
  return `R$ ${decimal.format(cents / 100_000_000_000)} bi`;
}

function formatRatio(hundredths: number | null) {
  return hundredths === null ? '—' : decimal.format(hundredths / 100);
}

function formatPercent(basisPoints: number) {
  return `${percent.format(basisPoints / 100)}%`;
}

function statusStyle(status: MarketStock['status']) {
  if (status === 'Abaixo do teto') return 'bg-emerald-50 text-emerald-800';
  if (status === 'Entre teto e justo') return 'bg-amber-50 text-amber-800';
  if (status === 'Acima do justo') return 'bg-rose-50 text-rose-800';
  return 'bg-slate-100 text-slate-700';
}

function readCell(stock: MarketStock, key: ColumnKey): string | number {
  switch (key) {
    case 'priceCents':
    case 'ceilingCents':
    case 'fairValueCents':
      return stock[key] ?? -1;
    case 'revenueCents':
    case 'profitCents':
    case 'marginBps':
    case 'peHundredths':
    case 'pbHundredths':
    case 'dividendYieldBps':
    case 'roeBps':
    case 'netDebtEbitdaHundredths':
      return stock[key] ?? -1;
    case 'ticker':
    case 'company':
    case 'sector':
    case 'status':
      return stock[key];
    case 'changeBps':
      return stock.changeBps ?? -1;
  }
}

function MarketHome({ quotes, quoteError }: MarketHomeProps) {
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('Todos os setores');
  const [yieldFilter, setYieldFilter] = useState('Todos');
  const [marginFilter, setMarginFilter] = useState('Todas');
  const [valuationFilter, setValuationFilter] = useState('Todos');
  const [sortKey, setSortKey] = useState<ColumnKey>('ticker');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(defaultColumns);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);
  const [detailStock, setDetailStock] = useState<MarketStock | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedElement = useRef<HTMLElement | null>(null);
  const quotesByTicker = useMemo(
    () => new Map(quotes.map((quote) => [quote.ticker, quote])),
    [quotes],
  );
  const stocks = useMemo(
    () =>
      illustrativeStocks.map((stock) => {
        const quote = quotesByTicker.get(stock.ticker);
        const price = quote?.price;

        return {
          ...stock,
          priceCents:
            typeof price === 'number' && Number.isFinite(price) && price > 0
              ? Math.round(price * 100)
              : null,
          changeBps: null,
          quoteAt: quote?.quoteAt ?? null,
          fetchedAt: quote?.fetchedAt ?? null,
          isStale: quote?.isStale ?? false,
        };
      }),
    [quotesByTicker],
  );
  const availableQuoteCount = stocks.filter((stock) => stock.priceCents !== null).length;
  const lastQuoteUpdate = stocks.reduce<string | null>((latest, stock) => {
    const fetchedAt = stock.fetchedAt;
    if (fetchedAt && (!latest || new Date(fetchedAt).getTime() > new Date(latest).getTime())) {
      return fetchedAt;
    }
    return latest;
  }, null);
  const latestQuoteAt = stocks.reduce<string | null>((latest, stock) => {
    const quoteAt = stock.quoteAt;
    if (quoteAt && (!latest || new Date(quoteAt).getTime() > new Date(latest).getTime())) {
      return quoteAt;
    }
    return latest;
  }, null);
  const hasStaleQuotes = stocks.some((stock) => stock.isStale);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('market-home-columns');
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (
          Array.isArray(parsed) &&
          parsed.every((key): key is ColumnKey => columns.some((column) => column.key === key)) &&
          parsed.includes('ticker')
        ) {
          setVisibleColumns(parsed);
        }
      }
    } catch (error) {
      console.error('Não foi possível carregar as colunas salvas.', error);
    }
  }, []);

  useEffect(() => {
    if (!detailStock) return;

    lastFocusedElement.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDetailStock(null);
      }

      if (event.key === 'Tab' && dialog) {
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      lastFocusedElement.current?.focus();
    };
  }, [detailStock]);

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
          (yieldFilter === 'Acima de 5%' && stock.dividendYieldBps >= 500) ||
          (yieldFilter === 'Acima de 8%' && stock.dividendYieldBps >= 800);
        const matchesMargin =
          marginFilter === 'Todas' ||
          (marginFilter === 'Abaixo do teto' && stock.status === 'Abaixo do teto') ||
          (marginFilter === 'Entre teto e justo' && stock.status === 'Entre teto e justo');
        const matchesValuation =
          valuationFilter === 'Todos' ||
          (valuationFilter === 'P/L abaixo de 15' &&
            stock.peHundredths !== null &&
            stock.peHundredths < 1500) ||
          (valuationFilter === 'P/VP abaixo de 2' &&
            stock.pbHundredths !== null &&
            stock.pbHundredths < 200);

        return matchesQuery && matchesSector && matchesYield && matchesMargin && matchesValuation;
      })
      .sort((a, b) => {
        const first = readCell(a, sortKey);
        const second = readCell(b, sortKey);
        const comparison =
          typeof first === 'number' && typeof second === 'number'
            ? first - second
            : String(first).localeCompare(String(second), 'pt-BR');
        return comparison * (sortDirection === 'asc' ? 1 : -1);
      });
  }, [query, sector, yieldFilter, marginFilter, valuationFilter, sortKey, sortDirection, stocks]);

  const comparedStocks = stocks.filter((stock) => selectedTickers.includes(stock.ticker));
  const selectedChartTickers = selectedTickers.slice(0, 3);
  const selectedChartData = quoteHistory.map((point, index) => {
    const data: Record<string, string | number> = { month: point.month };
    selectedChartTickers.forEach((ticker, tickerIndex) => {
      data[ticker] = performanceSeries[tickerIndex][index];
    });
    return data;
  });

  function setColumnVisibility(key: ColumnKey) {
    setVisibleColumns((current) => {
      const next = current.includes(key) ? current.filter((column) => column !== key) : [...current, key];
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

  function toggleComparison(ticker: string) {
    setSelectedTickers((current) => {
      if (current.includes(ticker)) return current.filter((item) => item !== ticker);
      if (current.length >= 4) return current;
      return [...current, ticker];
    });
  }

  function clearFilters() {
    setQuery('');
    setSector('Todos os setores');
    setYieldFilter('Todos');
    setMarginFilter('Todas');
    setValuationFilter('Todos');
  }

  function renderCell(stock: MarketStock, key: ColumnKey) {
    switch (key) {
      case 'ticker':
        return <span className="font-bold text-[#1d4ed8]">{stock.ticker}</span>;
      case 'company':
        return (
          <button
            className="text-left font-medium text-[#0b1b3f] hover:text-[#1d4ed8] hover:underline"
            onClick={() => setDetailStock(stock)}
          >
            {stock.company}
          </button>
        );
      case 'priceCents':
        return <span className="font-semibold text-[#0b1b3f]">{formatPrice(stock.priceCents)}</span>;
      case 'revenueCents':
        return formatBillions(stock.revenueCents);
      case 'profitCents':
        return formatBillions(stock.profitCents);
      case 'marginBps':
      case 'dividendYieldBps':
      case 'roeBps':
        return formatPercent(stock[key]);
      case 'peHundredths':
      case 'pbHundredths':
      case 'netDebtEbitdaHundredths':
        return formatRatio(stock[key]);
      case 'ceilingCents':
        return formatPrice(stock.ceilingCents);
      case 'fairValueCents':
        return formatPrice(stock.fairValueCents);
      case 'status':
        return (
          <span className={`inline-flex max-w-36 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(stock.status)}`}>
            {stock.status}
          </span>
        );
      case 'sector':
        return stock.sector;
    }
  }

  return (
    <div className="-mb-20 min-h-screen bg-[#f1f6ff] text-[#0b1b3f] lg:mb-0">
      <header className="sticky top-0 z-30 border-b border-[#dce6f7] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Financial Advisor, página inicial">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1d4ed8] text-white">
              <TrendingUp size={21} aria-hidden="true" />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-[#0b1b3f] sm:text-xl">
              Financial<span className="text-[#1d4ed8]">Advisor</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 lg:flex" aria-label="Navegação principal">
            <a className="text-[#1d4ed8]" href="#acoes">Ações</a>
            <a className="transition hover:text-[#1d4ed8]" href="#comparador">Comparador</a>
            <a className="transition hover:text-[#1d4ed8]" href="#agenda">Agenda de dividendos</a>
            <a className="transition hover:text-[#1d4ed8]" href="#metodologia">Como calculamos</a>
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <Link href="/entrar" className="rounded-lg px-4 py-2.5 text-sm font-bold text-[#1d4ed8] hover:bg-blue-50">
              Entrar
            </Link>
            <Link href="/registrar" className="rounded-lg bg-[#1d4ed8] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800">
              Criar conta
            </Link>
          </div>

          <button
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 sm:hidden"
            type="button"
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X size={21} /> : <ChevronDown size={21} />}
          </button>
        </div>
        {mobileMenuOpen && (
          <nav className="grid gap-1 border-t border-[#dce6f7] bg-white px-4 py-3 text-sm font-semibold sm:hidden" aria-label="Navegação móvel">
            <a className="rounded-lg px-3 py-2 hover:bg-blue-50" href="#acoes" onClick={() => setMobileMenuOpen(false)}>Ações</a>
            <a className="rounded-lg px-3 py-2 hover:bg-blue-50" href="#comparador" onClick={() => setMobileMenuOpen(false)}>Comparador</a>
            <a className="rounded-lg px-3 py-2 hover:bg-blue-50" href="#agenda" onClick={() => setMobileMenuOpen(false)}>Agenda de dividendos</a>
            <a className="rounded-lg px-3 py-2 hover:bg-blue-50" href="#metodologia" onClick={() => setMobileMenuOpen(false)}>Como calculamos</a>
            <div className="mt-2 flex gap-2 border-t border-slate-100 pt-3">
              <Link className="flex-1 rounded-lg border border-[#dce6f7] px-3 py-2 text-center text-[#1d4ed8]" href="/entrar">Entrar</Link>
              <Link className="flex-1 rounded-lg bg-[#1d4ed8] px-3 py-2 text-center text-white" href="/registrar">Criar conta</Link>
            </div>
          </nav>
        )}
      </header>

      <main>
        <section className="mx-auto max-w-[1440px] px-4 pb-8 pt-9 sm:px-6 sm:pt-12 lg:px-10 lg:pb-10">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#1d4ed8]">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              Mercado brasileiro
            </p>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[42px]">
              Invista em conhecimento,<br className="hidden sm:block" /> não em palpites.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Analise empresas da B3 com dados fundamentalistas e critérios transparentes.
              Compare indicadores com calma e tome suas próprias decisões.
            </p>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#dce6f7] bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ações acompanhadas</p>
              <p className="mt-2 text-2xl font-extrabold">{stocks.length} <span className="text-sm font-medium text-slate-500">ações</span></p>
            </div>
            <div className="rounded-2xl border border-[#dce6f7] bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cotações disponíveis</p>
              <p className="mt-2 text-2xl font-extrabold">{availableQuoteCount} <span className="text-sm font-medium text-slate-500">de {stocks.length}</span></p>
            </div>
            <div className="rounded-2xl border border-[#dce6f7] bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Última atualização</p>
              <p className="mt-2 inline-flex items-center gap-2 text-base font-bold">
                <Clock3 size={17} className={quoteError ? 'text-amber-600' : 'text-emerald-600'} aria-hidden="true" />
                {formatTimestamp(lastQuoteUpdate)}
              </p>
            </div>
          </div>

          {quoteError ? (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-900" role="alert">
              <Clock3 className="mt-0.5 shrink-0 text-rose-700" size={18} aria-hidden="true" />
              <p>{quoteError}</p>
            </div>
          ) : availableQuoteCount === 0 ? (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-950" role="status">
              <Clock3 className="mt-0.5 shrink-0 text-amber-700" size={18} aria-hidden="true" />
              <p>As cotações ainda não estão disponíveis. Os preços serão exibidos após a primeira coleta bem-sucedida.</p>
            </div>
          ) : (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-950" role="status">
              <Clock3 className="mt-0.5 shrink-0 text-amber-700" size={18} aria-hidden="true" />
              <p><strong>Cotações da BRAPI atualizadas diariamente.</strong> Os demais indicadores e gráficos ainda são ilustrativos.</p>
            </div>
          )}
        </section>

        <section id="acoes" className="mx-auto max-w-[1440px] scroll-mt-24 px-4 pb-12 sm:px-6 lg:px-10">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#1d4ed8]">Universo B3</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-[28px]">Ações em destaque</h2>
              <p className="mt-1 text-sm text-slate-600">Preços armazenados no Supabase; indicadores fundamentalistas ilustrativos.</p>
            </div>
            <p className="text-xs text-slate-500">Última atualização das cotações: {formatTimestamp(lastQuoteUpdate)}</p>
          </div>

          <div className="rounded-2xl border border-[#dce6f7] bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1.6fr)_repeat(4,minmax(140px,1fr))_auto]">
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
                <select className="h-11 w-full rounded-lg border border-[#dce6f7] bg-white px-3 text-sm outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-blue-100" value={sector} onChange={(event) => setSector(event.target.value)}>
                  {sectors.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">Filtrar por dividend yield</span>
                <select className="h-11 w-full rounded-lg border border-[#dce6f7] bg-white px-3 text-sm outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-blue-100" value={yieldFilter} onChange={(event) => setYieldFilter(event.target.value)}>
                  <option>Todos</option><option>Acima de 5%</option><option>Acima de 8%</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Filtrar por situação do preço</span>
                <select className="h-11 w-full rounded-lg border border-[#dce6f7] bg-white px-3 text-sm outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-blue-100" value={marginFilter} onChange={(event) => setMarginFilter(event.target.value)}>
                  <option>Todas</option><option>Abaixo do teto</option><option>Entre teto e justo</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Filtrar por múltiplos de valuation</span>
                <select className="h-11 w-full rounded-lg border border-[#dce6f7] bg-white px-3 text-sm outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-blue-100" value={valuationFilter} onChange={(event) => setValuationFilter(event.target.value)}>
                  <option>Todos</option><option>P/L abaixo de 15</option><option>P/VP abaixo de 2</option>
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
                {columnsOpen && (
                  <div className="absolute right-0 top-12 z-20 max-h-80 w-60 overflow-y-auto rounded-xl border border-[#dce6f7] bg-white p-2 shadow-xl" aria-label="Escolher colunas visíveis">
                    {columns.map((column) => (
                      <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-blue-50">
                        <input
                          className="accent-[#1d4ed8]"
                          type="checkbox"
                          checked={visibleColumns.includes(column.key)}
                          disabled={column.key === 'ticker'}
                          onChange={() => setColumnVisibility(column.key)}
                        />
                        {column.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-500" aria-live="polite">
                {filteredStocks.length} {filteredStocks.length === 1 ? 'empresa encontrada' : 'empresas encontradas'}
              </p>
              <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1d4ed8] hover:underline" type="button" onClick={clearFilters}>
                <X size={15} aria-hidden="true" /> Limpar filtros
              </button>
            </div>

            {filteredStocks.length === 0 ? (
              <div className="py-16 text-center">
                <Search className="mx-auto text-slate-300" size={32} aria-hidden="true" />
                <p className="mt-3 font-semibold">Nenhuma ação encontrada</p>
                <p className="mt-1 text-sm text-slate-500">Tente ajustar sua busca ou os filtros.</p>
              </div>
            ) : (
              <>
                <div className="mt-3 hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
                    <caption className="sr-only">Indicadores fundamentalistas demonstrativos das ações acompanhadas</caption>
                    <thead>
                      <tr className="border-y border-[#e7eef9] bg-[#f8faff] text-xs font-bold uppercase tracking-wide text-slate-500">
                        {columns.filter((column) => visibleColumns.includes(column.key)).map((column) => (
                          <th
                            key={column.key}
                            className={`whitespace-nowrap px-3 py-3 ${column.key === 'ticker' ? 'sticky left-0 z-10 bg-[#f8faff]' : ''}`}
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
                                sortDirection === 'asc' ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />
                              ) : (
                                <ArrowDownUp size={12} className="opacity-40" aria-hidden="true" />
                              )}
                            </button>
                          </th>
                        ))}
                        <th className="whitespace-nowrap px-3 py-3 text-right" scope="col">Comparar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStocks.map((stock) => (
                        <tr className="transition hover:bg-blue-50/50" key={stock.ticker}>
                          {columns.filter((column) => visibleColumns.includes(column.key)).map((column) => (
                            <td
                              key={column.key}
                              className={`whitespace-nowrap px-3 py-3.5 text-slate-700 ${column.key === 'ticker' ? 'sticky left-0 z-[1] bg-white font-semibold' : ''}`}
                            >
                              {renderCell(stock, column.key)}
                            </td>
                          ))}
                          <td className="px-3 py-3.5 text-right">
                            <button
                              className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-bold transition ${
                                selectedTickers.includes(stock.ticker)
                                  ? 'border-[#1d4ed8] bg-blue-50 text-[#1d4ed8]'
                                  : 'border-[#dce6f7] text-slate-600 hover:border-blue-300 hover:text-[#1d4ed8]'
                              }`}
                              type="button"
                              aria-pressed={selectedTickers.includes(stock.ticker)}
                              aria-label={`${selectedTickers.includes(stock.ticker) ? 'Remover' : 'Adicionar'} ${stock.ticker} ${selectedTickers.includes(stock.ticker) ? 'do' : 'ao'} comparador`}
                              onClick={() => toggleComparison(stock.ticker)}
                              disabled={!selectedTickers.includes(stock.ticker) && selectedTickers.length >= 4}
                            >
                              {selectedTickers.includes(stock.ticker) ? <Check size={14} aria-hidden="true" /> : null}
                              {selectedTickers.includes(stock.ticker) ? 'Selecionada' : 'Comparar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="mt-3 space-y-3 lg:hidden">
                  {filteredStocks.map((stock) => (
                    <li key={stock.ticker} className="rounded-xl border border-[#e7eef9] bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <button className="font-extrabold text-[#1d4ed8]" type="button" onClick={() => setDetailStock(stock)}>{stock.ticker}</button>
                          <p className="mt-0.5 text-sm font-medium">{stock.company}</p>
                          <p className="text-xs text-slate-500">{stock.sector}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle(stock.status)}`}>{stock.status}</span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-y-3 border-y border-slate-100 py-3 text-sm">
                        <div><p className="text-xs text-slate-500">Preço</p><p className="mt-0.5 font-bold">{formatPrice(stock.priceCents)}</p></div>
                        <div><p className="text-xs text-slate-500">Dividend yield</p><p className="mt-0.5 font-bold">{formatPercent(stock.dividendYieldBps)}</p></div>
                        <div><p className="text-xs text-slate-500">P/L</p><p className="mt-0.5 font-bold">{formatRatio(stock.peHundredths)}</p></div>
                        <div><p className="text-xs text-slate-500">ROE</p><p className="mt-0.5 font-bold">{formatPercent(stock.roeBps)}</p></div>
                        <div><p className="text-xs text-slate-500">Preço teto</p><p className="mt-0.5 font-bold">{formatPrice(stock.ceilingCents)}</p></div>
                        <div><p className="text-xs text-slate-500">Preço justo</p><p className="mt-0.5 font-bold">{formatPrice(stock.fairValueCents)}</p></div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button className="flex-1 rounded-lg border border-[#dce6f7] px-3 py-2 text-sm font-semibold text-slate-700" type="button" onClick={() => setDetailStock(stock)}>Ver indicadores</button>
                        <button
                          className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${selectedTickers.includes(stock.ticker) ? 'bg-blue-50 text-[#1d4ed8]' : 'bg-[#1d4ed8] text-white'}`}
                          type="button"
                          aria-pressed={selectedTickers.includes(stock.ticker)}
                          onClick={() => toggleComparison(stock.ticker)}
                          disabled={!selectedTickers.includes(stock.ticker) && selectedTickers.length >= 4}
                        >
                          {selectedTickers.includes(stock.ticker) ? 'Remover comparação' : 'Comparar'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-4 flex items-start gap-2 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
              <Clock3 className="mt-0.5 shrink-0" size={15} aria-hidden="true" />
              <span>
                {latestQuoteAt
                  ? `Cotações referentes a ${formatTimestamp(latestQuoteAt)}. Última atualização dos dados: ${formatTimestamp(lastQuoteUpdate)}.`
                  : 'Ainda não há cotações disponíveis para exibir.'}
                {hasStaleQuotes ? ' Algumas cotações não foram atualizadas na última coleta.' : ''}
              </span>
            </p>
          </div>
        </section>

        <section id="comparador" className="mx-auto max-w-[1440px] scroll-mt-24 px-4 pb-12 sm:px-6 lg:px-10">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#1d4ed8]">Análise lado a lado</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-[28px]">Comparador de ações</h2>
              <p className="mt-1 text-sm text-slate-600">Escolha de 2 a 4 empresas na tabela para comparar os indicadores.</p>
            </div>
            <span className="text-sm font-semibold text-slate-500">{selectedTickers.length}/4 selecionadas</span>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
            <div className="rounded-2xl border border-[#dce6f7] bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold">Indicadores selecionados</h3>
                <BarChart3 size={19} className="text-[#1d4ed8]" aria-hidden="true" />
              </div>
              {comparedStocks.length < 2 ? (
                <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-[#dce6f7] bg-[#f8faff] px-5 text-center">
                  <SlidersHorizontal className="text-blue-300" size={25} aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold">Comece selecionando pelo menos 2 ações</p>
                  <p className="mt-1 text-xs text-slate-500">Use o botão “Comparar” na tabela. Você pode selecionar até 4.</p>
                  <a className="mt-3 text-sm font-bold text-[#1d4ed8] hover:underline" href="#acoes">Escolher ações</a>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <caption className="sr-only">Comparação demonstrativa dos indicadores das ações escolhidas</caption>
                    <thead><tr className="border-b border-slate-100 text-xs text-slate-500"><th className="py-2" scope="col">Indicador</th>{comparedStocks.map((stock) => <th className="px-2 py-2" key={stock.ticker} scope="col">{stock.ticker}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr><th className="py-3 font-medium text-slate-600" scope="row">Preço</th>{comparedStocks.map((stock) => <td className="px-2 py-3 font-semibold" key={stock.ticker}>{formatPrice(stock.priceCents)}</td>)}</tr>
                      <tr><th className="py-3 font-medium text-slate-600" scope="row">P/L</th>{comparedStocks.map((stock) => <td className="px-2 py-3" key={stock.ticker}>{formatRatio(stock.peHundredths)}</td>)}</tr>
                      <tr><th className="py-3 font-medium text-slate-600" scope="row">Dividend yield</th>{comparedStocks.map((stock) => <td className="px-2 py-3" key={stock.ticker}>{formatPercent(stock.dividendYieldBps)}</td>)}</tr>
                      <tr><th className="py-3 font-medium text-slate-600" scope="row">ROE</th>{comparedStocks.map((stock) => <td className="px-2 py-3" key={stock.ticker}>{formatPercent(stock.roeBps)}</td>)}</tr>
                      <tr><th className="py-3 font-medium text-slate-600" scope="row">Situação</th>{comparedStocks.map((stock) => <td className="px-2 py-3" key={stock.ticker}><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusStyle(stock.status)}`}>{stock.status}</span></td>)}</tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#dce6f7] bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-bold">Desempenho comparado</h3>
                <span className="text-xs text-slate-500">Base 100 · demonstrativo</span>
              </div>
              {comparedStocks.length < 2 ? (
                <div className="flex min-h-44 items-center justify-center rounded-xl bg-[#f8faff] text-sm text-slate-500">
                  O gráfico aparece após selecionar 2 ou mais ações.
                </div>
              ) : (
                <div className="h-52 w-full" role="img" aria-label={`Gráfico demonstrativo de desempenho para ${selectedChartTickers.join(', ')} entre maio e outubro`}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 208 }}>
                    <LineChart data={selectedChartData} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="#e7eef9" strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Legend />
                      {selectedChartTickers.map((ticker, index) => (
                        <Line key={ticker} type="monotone" dataKey={ticker} stroke={['#1d4ed8', '#059669', '#d97706'][index]} strokeWidth={2.5} dot={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {comparedStocks.length > 3 && <p className="mt-2 text-xs text-slate-500">A tabela inclui as quatro ações; o gráfico mostra as três primeiras.</p>}
            </div>
          </div>
        </section>

        <section id="agenda" className="mx-auto max-w-[1440px] scroll-mt-24 px-4 pb-12 sm:px-6 lg:px-10">
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-[#dce6f7] bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 size={19} className="text-[#1d4ed8]" aria-hidden="true" />
                <h2 className="font-bold">Receita e lucro ao longo do tempo</h2>
              </div>
              <p className="mb-2 text-xs text-slate-500">Exemplo ilustrativo · valores em R$ bilhões</p>
              <div className="h-56 w-full" role="img" aria-label="Gráfico ilustrativo de receita e lucro entre 2021 e 2025, em bilhões de reais">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 224 }}>
                  <BarChart data={financialHistory} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#e7eef9" strokeDasharray="3 3" />
                    <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => [`R$ ${value} bi`]} />
                    <Legend />
                    <Bar dataKey="revenue" name="Receita" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" name="Lucro líquido" fill="#34a876" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="sr-only">Os valores apresentados no gráfico são dados fictícios, incluídos apenas para demonstrar o componente.</p>
            </article>
            <article className="rounded-2xl border border-[#dce6f7] bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp size={19} className="text-[#1d4ed8]" aria-hidden="true" />
                <h2 className="font-bold">Histórico de proventos</h2>
              </div>
              <p className="mb-2 text-xs text-slate-500">Exemplo ilustrativo · ativo demonstrativo PETR4</p>
              <div className="h-56 w-full" role="img" aria-label="Gráfico ilustrativo de proventos por ação entre 2021 e 2025">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 224 }}>
                  <BarChart data={dividendHistory} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#e7eef9" strokeDasharray="3 3" />
                    <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => [`R$ ${value} por ação`]} />
                    <Bar dataKey="dividends" name="Proventos por ação" fill="#e2a62a" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="sr-only">Os valores apresentados no gráfico são dados fictícios, incluídos apenas para demonstrar o componente.</p>
            </article>
          </div>
        </section>

        <section id="metodologia" className="mx-auto max-w-[1440px] scroll-mt-24 px-4 pb-12 sm:px-6 lg:px-10">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:p-7">
            <h2 className="text-lg font-extrabold">Transparência em primeiro lugar</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
              Os dados desta demonstração são fictícios. Em uma versão com dados reais, as cotações serão identificadas como atrasadas,
              acompanhadas do horário de atualização e das fontes. Indicadores e fórmulas serão explicados junto às respectivas premissas.
            </p>
            <p className="mt-3 text-sm font-semibold text-[#0b1b3f]">
              O conteúdo é exclusivamente informativo e não constitui recomendação de investimento.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dce6f7] bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <p>© 2026 Financial Advisor · Protótipo demonstrativo</p>
          <p>Conteúdo informativo, sem recomendação de investimento.</p>
        </div>
      </footer>

      {detailStock && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#07142d]/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetailStock(null);
          }}
        >
          <div
            aria-labelledby="stock-detail-title"
            aria-modal="true"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-7"
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#1d4ed8]">{detailStock.sector}</p>
                <h2 id="stock-detail-title" className="mt-1 text-2xl font-extrabold">{detailStock.ticker}</h2>
                <p className="mt-0.5 text-sm text-slate-600">{detailStock.company}</p>
              </div>
              <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" type="button" aria-label="Fechar detalhes" onClick={() => setDetailStock(null)}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-3 rounded-xl bg-[#f1f6ff] p-4">
              <div>
                <p className="text-xs text-slate-600">Cotação BRAPI</p>
                <p className="mt-1 text-2xl font-extrabold">{formatPrice(detailStock.priceCents)}</p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusStyle(detailStock.status)}`}>{detailStock.status}</span>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ['Receita', formatBillions(detailStock.revenueCents)],
                ['Lucro líquido', formatBillions(detailStock.profitCents)],
                ['Margem líquida', formatPercent(detailStock.marginBps)],
                ['P/L', formatRatio(detailStock.peHundredths)],
                ['P/VP', formatRatio(detailStock.pbHundredths)],
                ['Dividend yield', formatPercent(detailStock.dividendYieldBps)],
                ['ROE', formatPercent(detailStock.roeBps)],
                ['Dívida líquida/EBITDA', formatRatio(detailStock.netDebtEbitdaHundredths)],
                ['Preço teto (Bazin)', formatPrice(detailStock.ceilingCents)],
                ['Preço justo (Graham)', formatPrice(detailStock.fairValueCents)],
              ].map(([label, value]) => (
                <div className="rounded-lg border border-slate-100 p-3" key={label}>
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-1 font-bold">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
              <p><strong>Dados fictícios:</strong> valores e indicadores servem apenas para demonstrar a interface.</p>
              <p className="mt-1">As fórmulas de preço teto e preço justo podem não se aplicar a bancos, empresas sem dividendos regulares ou com dados insuficientes.</p>
              <p className="mt-1">Conteúdo informativo; não constitui recomendação de investimento.</p>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="rounded-lg border border-[#dce6f7] px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" type="button" onClick={() => setDetailStock(null)}>Fechar</button>
              <button
                className="rounded-lg bg-[#1d4ed8] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800"
                type="button"
                disabled={!selectedTickers.includes(detailStock.ticker) && selectedTickers.length >= 4}
                onClick={() => {
                  toggleComparison(detailStock.ticker);
                  setDetailStock(null);
                  window.setTimeout(() => document.getElementById('comparador')?.scrollIntoView({ behavior: 'smooth' }), 0);
                }}
              >
                {selectedTickers.includes(detailStock.ticker) ? 'Remover do comparador' : 'Adicionar ao comparador'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarketHome;
