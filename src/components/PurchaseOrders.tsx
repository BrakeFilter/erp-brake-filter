import { useState } from 'react';
import { ClipboardList, Send, CheckCircle2, X, Package, Clock, ArrowRightCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/ToastContainer';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PurchaseOrder, Supplier, PurchaseOrderStatus } from '@/types';

interface PurchaseOrdersProps {
  orders: PurchaseOrder[];
  suppliers: Supplier[];
  onRefresh: () => void;
}

export function PurchaseOrders({ orders, suppliers, onRefresh }: PurchaseOrdersProps) {
  const [filter, setFilter] = useState<PurchaseOrderStatus | 'all'>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  const counts = {
    pendiente: orders.filter((o) => o.status === 'pendiente').length,
    enviada: orders.filter((o) => o.status === 'enviada').length,
    recibida: orders.filter((o) => o.status === 'recibida').length,
  };

  const statusBadge = (status: PurchaseOrderStatus) => {
    const styles: Record<PurchaseOrderStatus, string> = {
      pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
      enviada: 'bg-blue-100 text-blue-700 border-blue-200',
      recibida: 'bg-green-100 text-green-700 border-green-200',
    };
    const labels: Record<PurchaseOrderStatus, string> = {
      pendiente: 'Pendiente',
      enviada: 'Enviada',
      recibida: 'Recibida',
    };
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const handleSend = async (orderId: string) => {
    const supplierId = selectedSupplier[orderId];
    if (!supplierId) {
      showToast('Selecciona un proveedor antes de enviar', 'error');
      return;
    }
    setProcessing(orderId);
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: 'enviada', supplier_id: supplierId, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    if (error) {
      showToast(`Error: ${error.message}`, 'error');
    } else {
      showToast('Orden enviada al proveedor', 'success');
      onRefresh();
    }
    setProcessing(null);
  };

  const handleReceive = async (order: PurchaseOrder) => {
    setProcessing(order.id);
    let successCount = 0;
    let failCount = 0;

    for (const item of order.items) {
      const { data: prod } = await supabase
        .from('products')
        .select('id')
        .eq('sku', item.sku)
        .maybeSingle();

      if (!prod) {
        showToast(`Producto no encontrado: ${item.sku}`, 'info');
        failCount++;
        continue;
      }

      const { error } = await supabase.rpc('process_movement', {
        p_product_id: prod.id,
        p_movement_type: 'entrada',
        p_quantity: item.quantity,
        p_user_name: 'Operador',
        p_notes: `Recepción orden de compra`,
      });

      if (error) {
        failCount++;
      } else {
        successCount++;
      }
    }

    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({ status: 'recibida', updated_at: new Date().toISOString() })
      .eq('id', order.id);

    if (updateError) {
      showToast(`Error al actualizar orden: ${updateError.message}`, 'error');
    } else {
      showToast(`Orden recibida: ${successCount} productos ingresados${failCount > 0 ? `, ${failCount} con error` : ''}`, 'success');
      onRefresh();
    }
    setProcessing(null);
  };

  const getSupplierName = (id: string | null) => {
    if (!id) return 'Sin proveedor';
    return suppliers.find((s) => s.id === id)?.name || 'Proveedor no encontrado';
  };

  const tabs: Array<{ key: PurchaseOrderStatus | 'all'; label: string; count: number }> = [
    { key: 'all', label: 'Todas', count: orders.length },
    { key: 'pendiente', label: 'Pendientes', count: counts.pendiente },
    { key: 'enviada', label: 'Enviadas', count: counts.enviada },
    { key: 'recibida', label: 'Recibidas', count: counts.recibida },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              filter === t.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${filter === t.key ? 'bg-white/20' : 'bg-slate-100'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No hay órdenes de compra en esta categoría</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <div key={order.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-slate-600">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{getSupplierName(order.supplier_id)}</p>
                    <p className="text-[11px] text-slate-400">{formatDate(order.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(order.status)}
                  <span className="text-sm font-bold text-slate-800">{formatCurrency(order.total_cost)}</span>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1 mb-3">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2">
                    <span className="text-slate-600">
                      <span className="font-mono font-medium text-slate-700">{item.sku}</span> — {item.name}
                    </span>
                    <span className="text-slate-500 flex-shrink-0">
                      {item.quantity}x · {formatCurrency(item.unit_cost)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Actions for pendiente */}
              {order.status === 'pendiente' && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <select
                    value={selectedSupplier[order.id] || ''}
                    onChange={(e) => setSelectedSupplier({ ...selectedSupplier, [order.id]: e.target.value })}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 bg-white"
                  >
                    <option value="">Seleccionar proveedor...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleSend(order.id)}
                    disabled={processing === order.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    Enviar
                  </button>
                </div>
              )}

              {/* Actions for enviada */}
              {order.status === 'enviada' && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleReceive(order)}
                    disabled={processing === order.id}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {processing === order.id ? 'Procesando...' : 'Marcar como Recibida (suma stock)'}
                  </button>
                </div>
              )}

              {/* Recibida badge */}
              {order.status === 'recibida' && (
                <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-xs text-green-600">
                  <CheckCircle2 className="w-4 h-4" />
                  Stock ingresado a bodega
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
