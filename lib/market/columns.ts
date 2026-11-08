import {
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
  formatRatio,
  formatValuationStatus,
} from './format.ts';
import type { MarketMetric, MarketStock } from './public-stocks.ts';

export type MarketColumnValue = string | number | null;
export type MarketColumnAlignment = 'left' | 'right';

export type MarketColumnDefinition = {
  id:
    | 'ticker'
    | 'company'
    | 'price'
    | 'revenue'
    | 'netIncome'
    | 'netMargin'
    | 'dividendYield'
    | 'ceiling'
    | 'fairPrice'
    | 'status'
    | 'sector'
    | 'operatingExpenses'
    | 'pe'
    | 'pb'
    | 'roe'
    | 'netDebtToEbitda';
  label: string;
  shortLabel: string;
  alignment: MarketColumnAlignment;
  defaultVisible: boolean;
  optional: boolean;
  sortable: boolean;
  description: string;
  mobilePriority: number | null;
  width: number;
  metric?: MarketMetric;
  getValue: (stock: MarketStock) => MarketColumnValue;
  format: (value: MarketColumnValue) => string;
};

const formatText = (value: MarketColumnValue) =>
  typeof value === 'string' ? value : '—';
const formatMoney = (value: MarketColumnValue) =>
  formatCurrency(typeof value === 'number' ? value : null);
const formatCompactMoney = (value: MarketColumnValue) =>
  formatCompactCurrency(typeof value === 'number' ? value : null);
const formatPercentage = (value: MarketColumnValue) =>
  formatPercent(typeof value === 'number' ? value : null);
const formatMultiple = (value: MarketColumnValue) =>
  formatRatio(typeof value === 'number' ? value : null);

export const MARKET_COLUMNS = [
  {
    id: 'ticker',
    label: 'Ticker',
    shortLabel: 'Ticker',
    alignment: 'left',
    defaultVisible: true,
    optional: false,
    sortable: true,
    description: 'Código de negociação da ação na B3.',
    mobilePriority: 1,
    width: 112,
    getValue: (stock) => stock.ticker,
    format: formatText,
  },
  {
    id: 'company',
    label: 'Empresa',
    shortLabel: 'Empresa',
    alignment: 'left',
    defaultVisible: true,
    optional: false,
    sortable: true,
    description: 'Nome da companhia vinculada ao ticker.',
    mobilePriority: 2,
    width: 180,
    getValue: (stock) => stock.company,
    format: formatText,
  },
  {
    id: 'price',
    label: 'Preço',
    shortLabel: 'Preço',
    alignment: 'right',
    defaultVisible: true,
    optional: false,
    sortable: true,
    description: 'Último preço armazenado, conforme a data da cotação informada na página.',
    mobilePriority: 4,
    width: 92,
    metric: 'price',
    getValue: (stock) => stock.price,
    format: formatMoney,
  },
  {
    id: 'revenue',
    label: 'Receita',
    shortLabel: 'Receita',
    alignment: 'right',
    defaultVisible: true,
    optional: false,
    sortable: true,
    description: 'Receita do último exercício anual consolidado disponível.',
    mobilePriority: 7,
    width: 128,
    metric: 'revenue',
    getValue: (stock) => stock.revenue,
    format: formatCompactMoney,
  },
  {
    id: 'netIncome',
    label: 'Lucro líquido',
    shortLabel: 'Lucro líquido',
    alignment: 'right',
    defaultVisible: true,
    optional: false,
    sortable: true,
    description: 'Lucro líquido do mesmo exercício anual consolidado da receita.',
    mobilePriority: 8,
    width: 128,
    metric: 'netIncome',
    getValue: (stock) => stock.netIncome,
    format: formatCompactMoney,
  },
  {
    id: 'netMargin',
    label: 'Margem líquida',
    shortLabel: 'Margem',
    alignment: 'right',
    defaultVisible: true,
    optional: false,
    sortable: true,
    description: 'Lucro líquido dividido pela receita no mesmo exercício anual consolidado.',
    mobilePriority: null,
    width: 108,
    metric: 'netMargin',
    getValue: (stock) => stock.netMargin,
    format: formatPercentage,
  },
  {
    id: 'dividendYield',
    label: 'Dividend yield',
    shortLabel: 'Dividend yield',
    alignment: 'right',
    defaultVisible: true,
    optional: false,
    sortable: true,
    description: 'Dividendos e JCP dos últimos 12 meses divididos pelo preço armazenado.',
    mobilePriority: 9,
    width: 108,
    metric: 'dividendYield',
    getValue: (stock) => stock.dividendYield,
    format: formatPercentage,
  },
  {
    id: 'ceiling',
    label: 'Preço teto',
    shortLabel: 'Preço teto',
    alignment: 'right',
    defaultVisible: true,
    optional: false,
    sortable: true,
    description: 'Bazin/Barsi: dividendos por ação divididos por 6%; janela informada na dica.',
    mobilePriority: 5,
    width: 108,
    metric: 'ceiling',
    getValue: (stock) => stock.ceiling,
    format: formatMoney,
  },
  {
    id: 'fairPrice',
    label: 'Preço justo',
    shortLabel: 'Preço justo',
    alignment: 'right',
    defaultVisible: true,
    optional: false,
    sortable: true,
    description: 'Graham: raiz de 22,5 vezes o LPA e o VPA atuais.',
    mobilePriority: 6,
    width: 108,
    metric: 'fairPrice',
    getValue: (stock) => stock.fairPrice,
    format: formatMoney,
  },
  {
    id: 'status',
    label: 'Situação',
    shortLabel: 'Situação',
    alignment: 'left',
    defaultVisible: true,
    optional: false,
    sortable: true,
    description: 'Classificação do preço em relação ao preço teto e ao preço justo.',
    mobilePriority: 3,
    width: 128,
    getValue: (stock) => formatValuationStatus(stock.status),
    format: formatText,
  },
  {
    id: 'sector',
    label: 'Setor',
    shortLabel: 'Setor',
    alignment: 'left',
    defaultVisible: false,
    optional: true,
    sortable: true,
    description: 'Setor cadastrado para a companhia.',
    mobilePriority: null,
    width: 120,
    getValue: (stock) => stock.sector,
    format: formatText,
  },
  {
    id: 'operatingExpenses',
    label: 'Despesas operacionais',
    shortLabel: 'Despesas',
    alignment: 'right',
    defaultVisible: false,
    optional: true,
    sortable: true,
    description: 'Soma absoluta das despesas do último exercício anual consolidado.',
    mobilePriority: null,
    width: 160,
    metric: 'operatingExpenses',
    getValue: (stock) => stock.operatingExpenses,
    format: formatCompactMoney,
  },
  {
    id: 'pe',
    label: 'P/L',
    shortLabel: 'P/L',
    alignment: 'right',
    defaultVisible: false,
    optional: true,
    sortable: true,
    description: 'Preço armazenado dividido pelo LPA atual; indisponível com LPA negativo.',
    mobilePriority: null,
    width: 80,
    metric: 'pe',
    getValue: (stock) => stock.pe,
    format: formatMultiple,
  },
  {
    id: 'pb',
    label: 'P/VP',
    shortLabel: 'P/VP',
    alignment: 'right',
    defaultVisible: false,
    optional: true,
    sortable: true,
    description: 'Preço armazenado dividido pelo valor patrimonial por ação atual.',
    mobilePriority: null,
    width: 80,
    metric: 'pb',
    getValue: (stock) => stock.pb,
    format: formatMultiple,
  },
  {
    id: 'roe',
    label: 'ROE',
    shortLabel: 'ROE',
    alignment: 'right',
    defaultVisible: false,
    optional: true,
    sortable: true,
    description: 'Retorno sobre o patrimônio informado nos fundamentos atuais/TTM.',
    mobilePriority: null,
    width: 80,
    metric: 'roe',
    getValue: (stock) => stock.roe,
    format: formatPercentage,
  },
  {
    id: 'netDebtToEbitda',
    label: 'Dívida líquida/EBITDA',
    shortLabel: 'Dívida/EBITDA',
    alignment: 'right',
    defaultVisible: false,
    optional: true,
    sortable: true,
    description: 'Dívida líquida dividida pelo EBITDA; não aplicável a bancos e seguradoras.',
    mobilePriority: null,
    width: 140,
    metric: 'netDebtToEbitda',
    getValue: (stock) => stock.netDebtToEbitda,
    format: formatMultiple,
  },
] satisfies readonly MarketColumnDefinition[];

export type MarketColumnId = (typeof MARKET_COLUMNS)[number]['id'];

export const DEFAULT_MARKET_COLUMNS: readonly MarketColumnId[] = MARKET_COLUMNS
  .filter((column) => column.defaultVisible)
  .map((column) => column.id);

export const MARKET_COLUMN_CONFIG_VERSION = '2';
const LEGACY_COLUMN_PREFERENCE_KEY = 'market-home-columns';
const COLUMN_PREFERENCE_VERSION_KEY = 'market-home-columns-version';

export function isMarketColumnId(value: string): value is MarketColumnId {
  return MARKET_COLUMNS.some((column) => column.id === value);
}

export function getVisibleMarketColumns(
  raw: string | string[] | null | undefined,
): MarketColumnId[] {
  if (raw === null || raw === undefined) return [...DEFAULT_MARKET_COLUMNS];

  const requested = (Array.isArray(raw) ? raw : [raw])
    .flatMap((value) => value.split(','))
    .filter(isMarketColumnId);
  if (requested.length === 0) return [...DEFAULT_MARKET_COLUMNS];

  const selected = new Set(requested);
  selected.add('ticker');
  selected.add('status');
  return MARKET_COLUMNS
    .filter((column) => selected.has(column.id))
    .map((column) => column.id);
}

export function isDefaultMarketColumnSelection(
  selected: readonly MarketColumnId[],
): boolean {
  return selected.length === DEFAULT_MARKET_COLUMNS.length &&
    DEFAULT_MARKET_COLUMNS.every((column) => selected.includes(column));
}

export function compareMarketColumnValues(
  first: MarketColumnValue,
  second: MarketColumnValue,
  direction: 'asc' | 'desc',
): number {
  if (first === null && second !== null) return 1;
  if (second === null && first !== null) return -1;
  if (first === null && second === null) return 0;

  const comparison =
    typeof first === 'number' && typeof second === 'number'
      ? first - second
      : String(first).localeCompare(String(second), 'pt-BR');
  return comparison * (direction === 'asc' ? 1 : -1);
}

export type ColumnPreferenceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function migrateLegacyColumnPreference(storage: ColumnPreferenceStorage): void {
  storage.removeItem(LEGACY_COLUMN_PREFERENCE_KEY);
  if (storage.getItem(COLUMN_PREFERENCE_VERSION_KEY) !== MARKET_COLUMN_CONFIG_VERSION) {
    storage.setItem(COLUMN_PREFERENCE_VERSION_KEY, MARKET_COLUMN_CONFIG_VERSION);
  }
}
