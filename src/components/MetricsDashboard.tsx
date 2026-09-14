import { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Calendar,
  BarChart3,
} from 'lucide-react';
import type { Movement, OperationalExpense } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface MetricsDashboardProps {
  movements: Movement[];
  expenses: OperationalExpense[];
}

type DateRange = 'this_month' | 'last_month' | 'custom';

export function MetricsDashboard({ movements, expenses }: MetricsDashboardProps) {
  const [range, setRange] = useState<DateRange>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (range === 'this_month') {
      return {
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
      };
    }
    if (range === 'last_month') {
      return {
        startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        endDate: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
      };
    }
    return {
      startDate: customStart ? new Date(customStart) : new Date(0),
      endDate: customEnd ? new Date(customEnd + 'T23:59:59') : new Date(),
    };
  }, [range, customStart, customEnd]);

  const sales = useMemo(
    () =>
      movements.filter((m) => {
        if (m.movement_type !== 'salida' || !m.sale_channel) return false;
        const d = new Date(m.created_at);
        return d >= startDate && d <= endDate;
      }),
    [movements, startDate, endDate],
  );

  const periodExpenses = useMemo(
    () =>
      expenses.filter((e) => {
        const d = new Date(e.expense_date);
        return d >= startDate && d <= endDate;
      }),
    [expenses, startDate, endDate],
  );

  const totalRevenue = sales.reduce((sum, s) => sum + (s.sale_price || 0), 0);
  const totalPurchaseCost = sales.reduce(
    (sum, s) => sum + (s.products?.price_total || 0) * s.quantity,
    0,
  );
  const totalShipping = sales.reduce((sum, s) => sum + (s.shipping_cost || 0), 0);
  const totalCommission = sales.reduce((sum, s) => sum + (s.commission || 0), 0);
  const totalExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalEgress = totalPurchaseCost + totalShipping + totalCommission + totalExpenses;
  const netProfit = totalRevenue - totalEgress;
  const avgTicket = sales.length > 0 ? totalRevenue / sales.length : 0;

  // Channel breakdown
  const mlSales = sales.filter((s) => s.sale_channel === 'mercadolibre');
  const directSales = sales.filter((s) => s.sale_channel === 'directa');
  const mlRevenue = mlSales.reduce((sum, s) => sum + (s.sale_price || 0), 0);
  const directRevenue = directSales.reduce((sum, s) => sum + (s.sale_price || 0), 0);
  const channelTotal = mlRevenue + directRevenue || 1;

  // Top 5 products by margin
  const productMargins = useMemo(() => {
    const map = new Map<string, { name: string; sku: string; margin: number; count: number }>();
    for (const s of sales) {
      const key = s.product_id;
      const existing = map.get(key) || {
        name: s.products?.name || 'Desconocido',
        sku: s.products?.sku || '—',
        margin: 0,
        count: 0,
      };
      existing.margin += s.net_margin || 0;
      existing.count += 1;
      map.set(key, existing);
    }
    return Array.from(map.values())
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 5);
  }, [sales]);

  // Daily revenue vs egress for chart
  const dailyData = useMemo(() => {
    const map = new Map<string, { revenue: number; egress: number }>();
    for (const s of sales) {
      const day = new Date(s.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
      const entry = map.get(day) || { revenue: 0, egress: 0 };
      entry.revenue += s.sale_price || 0;
      entry.egress += (s.products?.price_total || 0) * s.quantity + (s.shipping_cost || 0) + (s.commission || 0);
      map.set(day, entry);
    }
    for (const e of periodExpenses) {
      const day = new Date(e.expense_date).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
      const entry = map.get(day) || { revenue: 0, egress: 0 };
      entry.egress += e.amount;
      map.set(day, entry);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const [da] = a[0].split('-').map(Number);
      const [db] = b[0].split('-').map(Number);
      return da - db;
    });
  }, [sales, periodExpenses]);

  return (
    <div className="space-y-4">
      {/* Date Range Filter */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {(['this_month', 'last_month', 'custom'] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  range === r ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {r === 'this_month' && 'Este Mes'}
                {r === 'last_month' && 'Mes Anterior'}
                {r === 'custom' && 'Personalizado'}
              </button>
            ))}
          </div>
        </div>
        {range === 'custom' && (
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
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Ingresos Totales"
          value={formatCurrency(totalRevenue)}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
        />
        <KPICard
          label="Egresos Totales"
          value={formatCurrency(totalEgress)}
          icon={<TrendingDown className="w-5 h-5" />}
          color="red"
        />
        <KPICard
          label="Utilidad Neta Real"
          value={formatCurrency(netProfit)}
          icon={<DollarSign className="w-5 h-5" />}
          color={netProfit >= 0 ? 'green' : 'red'}
        />
        <KPICard
          label="Ticket Promedio"
          value={formatCurrency(avgTicket)}
          icon={<ShoppingCart className="w-5 h-5" />}
          color="blue"
          subtext={`${sales.length} ventas`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue vs Egress Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-800">Ingresos vs. Egresos</h3>
          </div>
          {dailyData.length === 0 ? (
            <EmptyChart />
          ) : (
            <BarChart data={dailyData} />
          )}
        </div>

        {/* Channel Donut Chart */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-800">Ventas por Canal</h3>
          </div>
          {channelTotal <= 1 ? (
            <EmptyChart />
          ) : (
            <div className="flex items-center gap-6">
              <DonutChart
                segments={[
                  { label: 'Mercado Libre', value: mlRevenue, color: '#EAB308' },
                  { label: 'Venta Directa', value: directRevenue, color: '#16A34A' },
                ]}
              />
              <div className="space-y-2 flex-1">
                <ChannelLegend
                  label="Mercado Libre"
                  amount={mlRevenue}
                  count={mlSales.length}
                  percentage={(mlRevenue / channelTotal) * 100}
                  color="#EAB308"
                />
                <ChannelLegend
                  label="Venta Directa"
                  amount={directRevenue}
                  count={directSales.length}
                  percentage={(directRevenue / channelTotal) * 100}
                  color="#16A34A"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top 5 Products by Margin */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-800">Top 5 — Mayor Margen de Utilidad</h3>
        </div>
        {productMargins.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="space-y-2.5">
            {productMargins.map((p, idx) => {
              const maxMargin = productMargins[0].margin || 1;
              const widthPct = Math.max((p.margin / maxMargin) * 100, 5);
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-700 truncate">
                        {p.sku} — {p.name}
                      </span>
                      <span
                        className={`text-sm font-bold flex-shrink-0 ml-2 ${p.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {formatCurrency(p.margin)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${p.margin >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  icon,
  color,
  subtext,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: 'green' | 'red' | 'blue';
  subtext?: string;
}) {
  const colors = {
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    blue: 'bg-blue-100 text-blue-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${colors[color]} mb-2`}>
        {icon}
      </div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5 truncate">{value}</p>
      {subtext && <p className="text-[11px] text-slate-400 mt-0.5">{subtext}</p>}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-slate-300">
      <Calendar className="w-10 h-10 mb-2" />
      <p className="text-xs text-slate-400">Sin datos para este período</p>
    </div>
  );
}

function BarChart({ data }: { data: Array<[string, { revenue: number; egress: number }]> }) {
  const maxVal = Math.max(...data.flatMap(([, v]) => [v.revenue, v.egress]), 1);
  const chartHeight = 160;

  return (
    <div>
      <div className="flex items-end justify-between gap-1.5" style={{ height: chartHeight }}>
        {data.map(([day, val]) => (
          <div key={day} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <div className="flex items-end gap-1 w-full justify-center" style={{ height: chartHeight - 24 }}>
              <div
                className="w-1/2 max-w-[16px] bg-green-500 rounded-t transition-all hover:bg-green-600"
                style={{ height: `${(val.revenue / maxVal) * (chartHeight - 24)}px` }}
                title={`Ingresos: ${formatCurrency(val.revenue)}`}
              />
              <div
                className="w-1/2 max-w-[16px] bg-red-500 rounded-t transition-all hover:bg-red-600"
                style={{ height: `${(val.egress / maxVal) * (chartHeight - 24)}px` }}
                title={`Egresos: ${formatCurrency(val.egress)}`}
              />
            </div>
            <span className="text-[9px] text-slate-400 truncate w-full text-center">{day}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-xs text-slate-500">Ingresos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span className="text-xs text-slate-500">Egresos</span>
        </div>
      </div>
    </div>
  );
}

function DonutChart({ segments }: { segments: Array<{ label: string; value: number; color: string }> }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = 55;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className="flex-shrink-0">
      <circle cx="70" cy="70" r={radius} fill="none" stroke="#F1F5F9" strokeWidth="18" />
      {segments.map((seg, idx) => {
        const pct = seg.value / total;
        const dash = pct * circumference;
        const circle = (
          <circle
            key={idx}
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="18"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 70 70)"
          />
        );
        offset += dash;
        return circle;
      })}
      <text x="70" y="65" textAnchor="middle" className="fill-slate-400 text-[9px] font-medium">
        Total
      </text>
      <text x="70" y="80" textAnchor="middle" className="fill-slate-800 text-xs font-bold">
        {formatCurrency(total)}
      </text>
    </svg>
  );
}

function ChannelLegend({
  label,
  amount,
  count,
  percentage,
  color,
}: {
  label: string;
  amount: number;
  count: number;
  percentage: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <div className="flex items-baseline gap-2 mt-0.5 ml-5">
        <span className="text-base font-bold text-slate-900">{formatCurrency(amount)}</span>
        <span className="text-xs text-slate-400">{percentage.toFixed(1)}% · {count} ventas</span>
      </div>
    </div>
  );
}
