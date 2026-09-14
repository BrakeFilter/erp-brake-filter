import { Package, AlertTriangle, Boxes, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface DashboardMetricsProps {
  totalValue: number;
  totalSkus: number;
  criticalCount: number;
  lowStockCount: number;
  onCriticalClick: () => void;
  criticalFilterActive: boolean;
}

export function DashboardMetrics({
  totalValue,
  totalSkus,
  criticalCount,
  lowStockCount,
  onCriticalClick,
  criticalFilterActive,
}: DashboardMetricsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {/* Total Bodega */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex items-center gap-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-slate-900 text-white flex-shrink-0">
          <TrendingUp className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Valor Total Bodega
          </p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5 truncate">
            {formatCurrency(totalValue)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Inventario valorizado c/IVA</p>
        </div>
      </div>

      {/* Total SKUs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex items-center gap-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-slate-700 text-white flex-shrink-0">
          <Boxes className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Total de SKUs
          </p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">{totalSkus}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Productos únicos registrados</p>
        </div>
      </div>

      {/* Crítico / Bajo Stock */}
      <button
        onClick={onCriticalClick}
        className={`text-left bg-white rounded-xl border shadow-sm p-4 sm:p-5 flex items-center gap-4 transition-all cursor-pointer hover:shadow-md hover:border-red-300 ${
          criticalFilterActive
            ? 'border-red-500 ring-2 ring-red-200'
            : 'border-slate-200'
        }`}
      >
        <div
          className={`flex items-center justify-center w-12 h-12 rounded-lg flex-shrink-0 transition-colors ${
            criticalFilterActive
              ? 'bg-red-600 text-white animate-pulse-red'
              : criticalCount > 0
                ? 'bg-red-100 text-red-600'
                : 'bg-amber-100 text-amber-600'
          }`}
        >
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Crítico / Bajo Stock
          </p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <p className="text-xl sm:text-2xl font-bold text-slate-900">{criticalCount}</p>
            <span className="text-xs text-slate-400">críticos</span>
            {lowStockCount > criticalCount && (
              <span className="text-xs text-amber-600 font-medium">
                +{lowStockCount - criticalCount} bajo
              </span>
            )}
          </div>
          <p className="text-[11px] text-red-500 mt-0.5 font-medium">
            {criticalFilterActive ? 'Filtro activo — click para quitar' : 'Click para filtrar'}
          </p>
        </div>
      </button>
    </div>
  );
}
