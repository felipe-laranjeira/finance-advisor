import type { ValuationStatus } from '../valuation.ts';

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

export function formatCurrency(value: number | null): string {
  return value === null ? '—' : currency.format(value);
}

export function formatCompactCurrency(value: number | null): string {
  return value === null ? '—' : compactCurrency.format(value);
}

export function formatRatio(value: number | null): string {
  return value === null ? '—' : decimal.format(value);
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${percentage.format(value * 100)}%`;
}

export function formatTimestamp(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

export function formatQuarter(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}/.test(value)) return '—';
  const [year, month] = value.slice(0, 7).split('-').map(Number);
  return `T${Math.ceil(month / 3)}/${year}`;
}

export function formatValuationStatus(status: ValuationStatus): string {
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

export function valuationStatusStyle(status: ValuationStatus): string {
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

export function tickerInitials(ticker: string): string {
  return ticker.slice(0, 2).toLocaleUpperCase('pt-BR');
}
