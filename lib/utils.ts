import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
};

export const formatReferenceDate = (dateString: string) => {
  try {
    const date = new Date(dateString + 'T12:00:00'); // Add time to avoid timezone issues
    const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date);
    const capitalizedMonth = month.charAt(0) ? month.charAt(0).toUpperCase() + month.slice(1).replace('.', '') : '';
    const year = date.getFullYear();
    return `${capitalizedMonth}/${year}`;
  } catch (e) {
    return dateString;
  }
};

export const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key: string, value: any) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
    }
    return value;
  };
};
