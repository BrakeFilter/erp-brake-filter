import { tenantConfig } from '@/config/tenantConfig';

export function formatCurrency(value: number): string {
  const rounded = Math.round(value);
  return `${tenantConfig.currencySymbol}${rounded.toLocaleString('es-CL')}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function daysUntil(dateStr: string): number {
  const due = new Date(dateStr);
  const now = new Date();
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diff = due.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isLowStock(stock: number, min: number): boolean {
  return stock <= min;
}

export function isCritical(stock: number, min: number): boolean {
  return stock <= min && min > 0 && stock === 0;
}

export function stockLabel(stock: number, min: number): { text: string; color: string } {
  if (stock === 0) return { text: 'SIN STOCK', color: 'red' };
  if (stock <= min) return { text: 'CRÍTICO', color: 'orange' };
  if (stock <= min + 2) return { text: 'BAJO', color: 'amber' };
  return { text: 'OK', color: 'green' };
}
