import { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Calendar, BarChart3,
  Trophy, Package, AlertTriangle, X, Download, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/ToastContainer';
import type { Movement, OperationalExpense, Product } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface MetricsDashboardProps {
  movements: Movement[];
  expenses: OperationalExpense[];
  products: Product[];
}

type DateRange = 'this_month' | 'last_month' | 'custom';
type ChartType = 'bars_v' | 'bars_h' | 'line' | 'donut' | 'table';
const CHART_STORAGE_KEY = 'bf_metrics_chart_type';

export function MetricsDashboard({ movements, expenses, products }: MetricsDashboardProps) {
  const [range, setRange] = useState<DateRange>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [chartType, setChartType] = useState<ChartType>(() => {
    try { return (localStorage.getItem(CHART_STORAGE_KEY) as ChartType) || 'bars_v'; } catch { return 'bars_v'; }
  });
  const [showTop100, setShowTop100] = useState(false);
  const [unsoldMonths, setUnsoldMonths] = useState(2);

  useEffect(() => {
    try { localStorage.setItem(CHART_STORAGE_KEY, chartType); } catch { /* ignore */ }
  }, [chartType]);

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

  // Egress movements (salida without sale_channel = stock removal/loss)
  const egressMovements = useMemo(
    () =>
      movements.filter((m) => {
        if (m.movement_type !== 'salida' || m.sale_channel) return false;
        const d = new Date(m.created_at);
        return d >= startDate && d <= endDate;
      }),
    [movements, startDate, endDate],
  );

  const totalRevenue = sales.reduce((sum, s) => sum + (s.sale_price || 0), 0);
  const totalPurchaseCost = sales.reduce(
    (sum, s) => sum + (s.products?.price_total || 0) * s.quantity,
    0,
  );
  const totalShipping = sales.reduce((sum, s) => sum + (s.shipping_cost || 0), 0);
  const totalCommission = sales.reduce((sum, s) => sum + (s.commission || 0), 0);
  const totalOpExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalEgressMovements = egressMovements.reduce(
    (sum, m) => sum + (m.total_amount || 0),
    0,
  );

  const totalEgress = totalOpExpenses + totalEgressMovements;
  const fifoCost = totalPurchaseCost;
  const netProfit = totalRevenue - totalEgress - fifoCost;
  const avgTicket = sales.length > 0 ? totalRevenue / sales.length : 0;

  // Channel breakdown
  const mlSales = sales.filter((s) => s.sale_channel === 'mercadolibre');
  const directSales = sales.filter((s) => s.sale_channel === 'directa');
  const mlRevenue = mlSales.reduce((sum, s) => sum + (s.sale_price || 0), 0);
  const directRevenue = directSales.reduce((sum, s) => sum + (s.sale_price || 0), 0);
  const channelTotal = mlRevenue + directRevenue || 1;

  // Top 10 by margin
  const productMargins = useMemo(() => {
    const map = new Map<string, { name: string; sku: string; margin: number; count: number; revenue: number }>();
    for (const s of sales) {
      const key = s.product_id;
      const existing = map.get(key) || {
        name: s.products?.name || 'Desconocido',
        sku: s.products?.sku || '—',
        margin: 0,
        count: 0,
        revenue: 0,
      };
      existing.margin += s.net_margin || 0;
      existing.count += s.quantity;
      existing.revenue += s.sale_price || 0;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.margin - a.margin);
  }, [sales]);

  // Top 10 most sold
  const topSold = useMemo(() => {
    const map = new Map<string, { name: string; sku: string; qty: number; revenue: number }>();
    for (const s of sales) {
      const key = s.product_id;
      const existing = map.get(key) || { name: s.products?.name || '—', sku: s.products?.sku || '—', qty: 0, revenue: 0 };
      existing.qty += s.quantity;
      existing.revenue += s.sale_price || 0;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [sales]);

  // Unsold products
  const unsoldProducts = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - unsoldMonths);
    const soldSkus = new Set(
      movements
        .filter((m) => m.movement_type === 'salida' && m.sale_channel && new Date(m.created_at) >= cutoff)
        .map((m) => m.product_id),
    );
    return products
      .filter((p) => p.stock_current > 0 && !soldSkus.has(p.id))
      .map((p) => {
        const lastSale = movements
          .filter((m) => m.product_id === p.id && m.movement_type === 'salida' && m.sale_channel)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        const daysSince = lastSale
          ? Math.floor((Date.now() - new Date(lastSale.created_at).getTime()) / 86400000)
          : 9999;
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: p.stock_current,
          lastSale: lastSale ? new Date(lastSale.created_at).toLocaleDateString('es-CL') : 'Nunca',
          daysSince,
          immobilizedValue: p.price_total * p.stock_current,
        };
      })
      .sort((a, b) => b.immobilizedValue - a.immobilizedValue);
  }, [products, movements, unsoldMonths]);

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

  const chartTypeOptions: Array<{ key: ChartType; label: string }> = [
    { key: 'bars_v', label: 'Barras V' },
    { key: 'bars_h', label: 'Barras H' },
    { key: 'line', label: 'Línea' },
    { key: 'donut', label: 'Torta' },
    { key: 'table', label: 'Tabla' },
  ];

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
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Hasta</label>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400" />
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard label="Ingresos" value={formatCurrency(totalRevenue)} icon={<TrendingUp className="w-5 h-5" />} color="green" />
        <KPICard label="Egresos" value={formatCurrency(totalEgress)} icon={<TrendingDown className="w-5 h-5" />} color="red"
          subtext={`Op: ${formatCurrency(totalOpExpenses)} · Stock: ${formatCurrency(totalEgressMovements)}`} />
        <KPICard label="Utilidad Neta Real" value={formatCurrency(netProfit)} icon={<DollarSign className="w-5 h-5" />}
          color={netProfit >= 0 ? 'green' : 'red'} subtext={`FIFO: ${formatCurrency(fifoCost)}`} />
        <KPICard label="Ticket Promedio" value={formatCurrency(avgTicket)} icon={<ShoppingCart className="w-5 h-5" />} color="blue"
          subtext={`${sales.length} ventas`} />
      </div>

      {/* Charts Row with chart type selector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-800">Ingresos vs. Egresos</h3>
            </div>
            <div className="flex gap-1 flex-wrap">
              {chartTypeOptions.map((opt) => (
                <button key={opt.key} onClick={() => setChartType(opt.key)}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                    chartType === opt.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {dailyData.length === 0 ? (
            <EmptyChart />
          ) : chartType === 'bars_v' ? (
            <BarChartV data={dailyData} />
          ) : chartType === 'bars_h' ? (
            <BarChartH data={dailyData} />
          ) : chartType === 'line' ? (
            <LineChart data={dailyData} />
          ) : chartType === 'donut' ? (
            <DonutChart segments={[
              { label: 'Ingresos', value: totalRevenue, color: '#16A34A' },
              { label: 'Egresos', value: totalEgress, color: '#DC2626' },
            ]} />
          ) : (
            <DataTable data={dailyData} />
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-800">Ventas por Canal</h3>
          </div>
          {channelTotal <= 1 ? (
            <EmptyChart />
          ) : (
            <div className="flex items-center gap-6">
              <DonutChart segments={[
                { label: 'Mercado Libre', value: mlRevenue, color: '#EAB308' },
                { label: 'Venta Directa', value: directRevenue, color: '#16A34A' },
              ]} />
              <div className="space-y-2 flex-1">
                <ChannelLegend label="Mercado Libre" amount={mlRevenue} count={mlSales.length}
                  percentage={(mlRevenue / channelTotal) * 100} color="#EAB308" />
                <ChannelLegend label="Venta Directa" amount={directRevenue} count={directSales.length}
                  percentage={(directRevenue / channelTotal) * 100} color="#16A34A" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top 10 Margin */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-800">Top 10 — Mayor Margen de Utilidad</h3>
        </div>
        {productMargins.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="space-y-2.5">
            {productMargins.slice(0, 10).map((p, idx) => {
              const maxMargin = productMargins[0].margin || 1;
              const widthPct = Math.max((p.margin / maxMargin) * 100, 5);
              const marginPct = p.revenue > 0 ? ((p.margin / p.revenue) * 100).toFixed(1) : '0';
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-700 truncate">{p.sku} — {p.name}</span>
                      <span className={`text-sm font-bold flex-shrink-0 ml-2 ${p.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(p.margin)} <span className="text-[10px] text-slate-400">({marginPct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${p.margin >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${widthPct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top 10 Most Sold + Ver Todos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-800">Top 10 — Más Vendidos</h3>
          </div>
          {topSold.length > 10 && (
            <button onClick={() => setShowTop100(true)}
              className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700">
              Ver Todos <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
        {topSold.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="space-y-2.5">
            {topSold.slice(0, 10).map((p, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700 truncate">{p.sku} — {p.name}</span>
                    <span className="text-sm font-bold text-blue-600 flex-shrink-0 ml-2">{p.qty} un.</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.max((p.qty / topSold[0].qty) * 100, 5)}%` }} />
                  </div>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{formatCurrency(p.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unsold Products */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-800">Productos No Vendidos</h3>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Últimos</label>
            <input type="number" value={unsoldMonths} onChange={(e) => setUnsoldMonths(Math.max(1, parseInt(e.target.value) || 2))}
              min={1} max={24}
              className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500/30" />
            <span className="text-xs text-slate-500">meses</span>
          </div>
        </div>
        {unsoldProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-300">
            <Package className="w-10 h-10 mb-2" />
            <p className="text-xs text-slate-400">Todos los productos con stock han tenido ventas recientes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-xs font-medium text-slate-500 uppercase">Producto</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-slate-500 uppercase">Stock</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-slate-500 uppercase">Última Venta</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-slate-500 uppercase">Días Sin Vender</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 uppercase">Valor Inmovilizado</th>
                </tr>
              </thead>
              <tbody>
                {unsoldProducts.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 bg-amber-50/50 hover:bg-amber-50">
                    <td className="py-2 px-2 text-slate-700 font-medium">{p.sku} — {p.name}</td>
                    <td className="py-2 px-2 text-center text-slate-600">{p.stock}</td>
                    <td className="py-2 px-2 text-center text-slate-500 text-xs">{p.lastSale}</td>
                    <td className="py-2 px-2 text-center">
                      <span className={`text-xs font-medium ${p.daysSince > 60 ? 'text-red-600' : 'text-amber-600'}`}>
                        {p.daysSince === 9999 ? 'Nunca' : `${p.daysSince} días`}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right font-semibold text-amber-700">{formatCurrency(p.immobilizedValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top 100 Modal */}
      {showTop100 && (
        <Top100Modal
          data={topSold}
          onClose={() => setShowTop100(false)}
        />
      )}
    </div>
  );
}

function KPICard({ label, value, icon, color, subtext }: {
  label: string; value: string; icon: React.ReactNode; color: 'green' | 'red' | 'blue'; subtext?: string;
}) {
  const colors = {
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    blue: 'bg-blue-100 text-blue-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${colors[color]} mb-2`}>{icon}</div>
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

function BarChartV({ data }: { data: Array<[string, { revenue: number; egress: number }]> }) {
  const maxVal = Math.max(...data.flatMap(([, v]) => [v.revenue, v.egress]), 1);
  const chartHeight = 160;
  return (
    <div>
      <div className="flex items-end justify-between gap-1.5" style={{ height: chartHeight }}>
        {data.map(([day, val]) => (
          <div key={day} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <div className="flex items-end gap-1 w-full justify-center" style={{ height: chartHeight - 24 }}>
              <div className="w-1/2 max-w-[16px] bg-green-500 rounded-t transition-all hover:bg-green-600"
                style={{ height: `${(val.revenue / maxVal) * (chartHeight - 24)}px` }} title={`Ingresos: ${formatCurrency(val.revenue)}`} />
              <div className="w-1/2 max-w-[16px] bg-red-500 rounded-t transition-all hover:bg-red-600"
                style={{ height: `${(val.egress / maxVal) * (chartHeight - 24)}px` }} title={`Egresos: ${formatCurrency(val.egress)}`} />
            </div>
            <span className="text-[9px] text-slate-400 truncate w-full text-center">{day}</span>
          </div>
        ))}
      </div>
      <Legend />
    </div>
  );
}

function BarChartH({ data }: { data: Array<[string, { revenue: number; egress: number }]> }) {
  const maxVal = Math.max(...data.flatMap(([, v]) => [v.revenue, v.egress]), 1);
  return (
    <div className="space-y-2 max-h-[200px] overflow-y-auto">
      {data.map(([day, val]) => (
        <div key={day} className="space-y-1">
          <span className="text-[10px] text-slate-400">{day}</span>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${(val.revenue / maxVal) * 100}%` }} />
            </div>
            <span className="text-[10px] text-slate-500 w-20 text-right">{formatCurrency(val.revenue)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{ width: `${(val.egress / maxVal) * 100}%` }} />
            </div>
            <span className="text-[10px] text-slate-500 w-20 text-right">{formatCurrency(val.egress)}</span>
          </div>
        </div>
      ))}
      <Legend />
    </div>
  );
}

function LineChart({ data }: { data: Array<[string, { revenue: number; egress: number }]> }) {
  const maxVal = Math.max(...data.flatMap(([, v]) => [v.revenue, v.egress]), 1);
  const width = 100;
  const height = 160;
  const points = (key: 'revenue' | 'egress') =>
    data.map(([day, val], i) => {
      const x = (i / Math.max(data.length - 1, 1)) * width;
      const y = height - (val[key] / maxVal) * (height - 20) - 10;
      return `${x},${y}`;
    }).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
        <polyline points={points('revenue')} fill="none" stroke="#16A34A" strokeWidth="1.5" />
        <polyline points={points('egress')} fill="none" stroke="#DC2626" strokeWidth="1.5" />
        {data.map(([day, val], i) => {
          const x = (i / Math.max(data.length - 1, 1)) * width;
          const yRev = height - (val.revenue / maxVal) * (height - 20) - 10;
          const yEgr = height - (val.egress / maxVal) * (height - 20) - 10;
          return (
            <g key={day}>
              <circle cx={x} cy={yRev} r="1.5" fill="#16A34A" />
              <circle cx={x} cy={yEgr} r="1.5" fill="#DC2626" />
            </g>
          );
        })}
      </svg>
      <Legend />
    </div>
  );
}

function DataTable({ data }: { data: Array<[string, { revenue: number; egress: number }]> }) {
  return (
    <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-slate-200">
            <th className="text-left py-2 text-xs font-medium text-slate-500">Día</th>
            <th className="text-right py-2 text-xs font-medium text-slate-500">Ingresos</th>
            <th className="text-right py-2 text-xs font-medium text-slate-500">Egresos</th>
          </tr>
        </thead>
        <tbody>
          {data.map(([day, val]) => (
            <tr key={day} className="border-b border-slate-100">
              <td className="py-1.5 text-slate-600">{day}</td>
              <td className="py-1.5 text-right text-green-600 font-medium">{formatCurrency(val.revenue)}</td>
              <td className="py-1.5 text-right text-red-600 font-medium">{formatCurrency(val.egress)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Legend() {
  return (
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
  );
}

function DonutChart({ segments }: { segments: Array<{ label: string; value: number; color: string }> }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
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
          <circle key={idx} cx="70" cy="70" r={radius} fill="none" stroke={seg.color} strokeWidth="18"
            strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset}
            transform="rotate(-90 70 70)" />
        );
        offset += dash;
        return circle;
      })}
      <text x="70" y="65" textAnchor="middle" className="fill-slate-400 text-[9px] font-medium">Total</text>
      <text x="70" y="80" textAnchor="middle" className="fill-slate-800 text-xs font-bold">{formatCurrency(total)}</text>
    </svg>
  );
}

function ChannelLegend({ label, amount, count, percentage, color }: {
  label: string; amount: number; count: number; percentage: number; color: string;
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

function Top100Modal({ data, onClose }: {
  data: Array<{ name: string; sku: string; qty: number; revenue: number }>;
  onClose: () => void;
}) {
  const exportCSV = () => {
    const rows = [['Ranking', 'SKU', 'Producto', 'Cantidad', 'Ingresos']];
    data.slice(0, 100).forEach((p, i) => {
      rows.push([String(i + 1), p.sku, p.name, String(p.qty), String(p.revenue)]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'top-100-vendidos.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exportado', 'success');
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[90] flex items-center justify-center p-3 sm:p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-slate-900">Top 100 — Productos Más Vendidos</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700">
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 text-xs font-medium text-slate-500">#</th>
                <th className="text-left py-2 text-xs font-medium text-slate-500">SKU</th>
                <th className="text-left py-2 text-xs font-medium text-slate-500">Producto</th>
                <th className="text-center py-2 text-xs font-medium text-slate-500">Cantidad</th>
                <th className="text-right py-2 text-xs font-medium text-slate-500">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 100).map((p, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 text-slate-400 font-medium">{idx + 1}</td>
                  <td className="py-2 text-slate-600 font-mono text-xs">{p.sku}</td>
                  <td className="py-2 text-slate-700">{p.name}</td>
                  <td className="py-2 text-center font-bold text-blue-600">{p.qty}</td>
                  <td className="py-2 text-right text-slate-600">{formatCurrency(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
