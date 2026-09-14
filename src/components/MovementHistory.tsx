import { useState, useMemo } from 'react';
import { History, ArrowDownToLine, ArrowUpFromLine, Scale, FileSpreadsheet, Calendar } from 'lucide-react';
import type { Movement, MovementType } from '@/types';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { exportMovementsToExcel } from '@/lib/excel';
import { ProductImage } from '@/components/ProductImage';

interface MovementHistoryProps {
  movements: Movement[];
}

type DateFilter = 'all' | 'today' | '7d' | '30d' | 'custom';

export function MovementHistory({ movements }: MovementHistoryProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const filtered = useMemo(() => {
    if (dateFilter === 'all') return movements;

    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (dateFilter === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (dateFilter === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === 'custom') {
      if (customStart) startDate = new Date(customStart);
      if (customEnd) endDate = new Date(customEnd + 'T23:59:59');
    }

    return movements.filter((m) => {
      const mDate = new Date(m.created_at);
      if (startDate && mDate < startDate) return false;
      if (endDate && mDate > endDate) return false;
      return true;
    });
  }, [movements, dateFilter, customStart, customEnd]);

  const movementConfig: Record<
    MovementType,
    { icon: typeof ArrowDownToLine; label: string; color: string; bg: string }
  > = {
    entrada: {
      icon: ArrowDownToLine,
      label: 'Entrada',
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    salida: {
      icon: ArrowUpFromLine,
      label: 'Salida',
      color: 'text-red-600',
      bg: 'bg-red-100',
    },
    ajuste: {
      icon: Scale,
      label: 'Ajuste',
      color: 'text-amber-600',
      bg: 'bg-amber-100',
    },
  };

  return (
    <div className="space-y-4">
      {/* Filters + Export */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 'today', '7d', '30d', 'custom'] as DateFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  dateFilter === f
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f === 'all' && 'Todo'}
                {f === 'today' && 'Hoy'}
                {f === '7d' && '7 días'}
                {f === '30d' && '30 días'}
                {f === 'custom' && 'Personalizado'}
              </button>
            ))}
          </div>
          <button
            onClick={() => exportMovementsToExcel(filtered)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exportar Excel
          </button>
        </div>

        {dateFilter === 'custom' && (
          <div className="flex gap-3 mt-3 animate-fade-in">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Desde</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Hasta</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
              />
            </div>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-sm text-slate-500">
          <History className="w-4 h-4" />
          <span>{filtered.length} movimiento{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Movement List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No hay movimientos en este período</p>
          </div>
        ) : (
          filtered.map((m) => {
            const cfg = movementConfig[m.movement_type];
            const Icon = cfg.icon;

            return (
              <div
                key={m.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex items-center gap-3 hover:shadow-md transition-all"
              >
                <ProductImage
                  src={m.products?.image_url}
                  alt={m.products?.name || 'Producto'}
                  size="sm"
                />
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${cfg.bg} ${cfg.color}`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-xs font-medium text-slate-700">
                      {m.products?.sku || '—'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 truncate mt-0.5">
                    {m.products?.name || 'Producto eliminado'}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                    <Calendar className="w-3 h-3" />
                    {formatDateTime(m.created_at)}
                    <span className="text-slate-300">|</span>
                    <span>{m.user_name}</span>
                    {m.notes && (
                      <>
                        <span className="text-slate-300">|</span>
                        <span className="truncate italic">{m.notes}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${m.movement_type === 'salida' ? 'text-red-600' : 'text-green-600'}`}>
                    {m.movement_type === 'salida' ? '-' : '+'}{m.quantity}
                  </p>
                  <p className="text-xs text-slate-400">{formatCurrency(m.total_amount)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
