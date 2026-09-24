import { useState } from 'react';
import {
  ClipboardList, Send, CheckCircle2, X, Package, Pencil, FileText,
  Share2, Trash2, Save, MessageCircle, Mail,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/ToastContainer';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PurchaseOrder, Supplier, PurchaseOrderStatus, PurchaseOrderItem } from '@/types';

interface PurchaseOrdersProps {
  orders: PurchaseOrder[];
  suppliers: Supplier[];
  onRefresh: () => void;
}

export function PurchaseOrders({ orders, suppliers, onRefresh }: PurchaseOrdersProps) {
  const [filter, setFilter] = useState<PurchaseOrderStatus | 'all'>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [editItems, setEditItems] = useState<PurchaseOrderItem[]>([]);
  const [editSupplierId, setEditSupplierId] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

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
    const supplierId = selectedSupplier[orderId] || orders.find(o => o.id === orderId)?.supplier_id;
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
        p_notes: 'Recepción orden de compra',
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

  const openEdit = (order: PurchaseOrder) => {
    setEditingOrder(order);
    setEditItems([...order.items]);
    setEditSupplierId(order.supplier_id || '');
  };

  const updateEditItem = (idx: number, field: keyof PurchaseOrderItem, value: string | number) => {
    setEditItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item,
      ),
    );
  };

  const removeEditItem = (idx: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveEdit = async () => {
    if (!editingOrder) return;
    if (editItems.length === 0) {
      showToast('La orden debe tener al menos un producto', 'error');
      return;
    }
    setSavingEdit(true);
    const totalCost = editItems.reduce((sum, i) => sum + i.unit_cost * i.quantity, 0);
    const { error } = await supabase
      .from('purchase_orders')
      .update({
        items: editItems as unknown as Record<string, unknown>,
        total_cost: totalCost,
        supplier_id: editSupplierId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingOrder.id);

    if (error) {
      showToast(`Error: ${error.message}`, 'error');
    } else {
      showToast('Orden actualizada', 'success');
      setEditingOrder(null);
      onRefresh();
    }
    setSavingEdit(false);
  };

  const generatePDFText = (order: PurchaseOrder): string => {
    const supplierName = getSupplierName(order.supplier_id);
    const lines: string[] = [
      '===========================================',
      '         ORDEN DE COMPRA',
      '===========================================',
      '',
      `Proveedor: ${supplierName}`,
      `Fecha:     ${formatDate(order.created_at)}`,
      `Estado:    ${order.status.toUpperCase()}`,
      '',
      '-------------------------------------------',
      'SKU         PRODUCTO              CANT  COSTO',
      '-------------------------------------------',
    ];
    order.items.forEach((item) => {
      const sku = item.sku.padEnd(12).slice(0, 12);
      const name = (item.name || '').padEnd(20).slice(0, 20);
      const qty = String(item.quantity).padStart(4);
      const cost = formatCurrency(item.unit_cost).padStart(10);
      lines.push(`${sku} ${name} ${qty} ${cost}`);
    });
    lines.push('-------------------------------------------');
    lines.push(`TOTAL: ${formatCurrency(order.total_cost)}`);
    lines.push('');
    lines.push('===========================================');
    lines.push('  BRAKE FILTER - Control de Bodega & ERP');
    lines.push('===========================================');
    return lines.join('\n');
  };

  const handleDownloadPDF = (order: PurchaseOrder) => {
    const text = generatePDFText(order);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orden-compra-${order.id.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Orden descargada', 'success');
  };

  const handleShare = async (order: PurchaseOrder) => {
    const supplierName = getSupplierName(order.supplier_id);
    let message = `*ORDEN DE COMPRA - BRAKE FILTER*\n\n`;
    message += `Proveedor: ${supplierName}\n`;
    message += `Fecha: ${formatDate(order.created_at)}\n\n`;
    message += `*Productos:*\n`;
    order.items.forEach((item) => {
      message += `• ${item.sku} - ${item.name}\n  ${item.quantity}x ${formatCurrency(item.unit_cost)}\n`;
    });
    message += `\n*TOTAL: ${formatCurrency(order.total_cost)}*\n`;

    // Try native share first
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Orden de Compra', text: message });
        showToast('Orden compartida', 'success');
        return;
      } catch {
        // User cancelled or error, fall through to WhatsApp
      }
    }

    // Fallback: copy to clipboard + offer WhatsApp
    try {
      await navigator.clipboard.writeText(message);
    } catch { /* ignore */ }

    const supplier = suppliers.find(s => s.id === order.supplier_id);
    const phone = supplier?.phone?.replace(/[^0-9]/g, '') || '';
    if (phone) {
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');
      showToast('Orden abierta en WhatsApp', 'success');
    } else {
      showToast('Orden copiada al portapapeles (proveedor sin teléfono)', 'info');
    }
  };

  const handleShareEmail = (order: PurchaseOrder) => {
    const supplierName = getSupplierName(order.supplier_id);
    const subject = `Orden de Compra - BRAKE FILTER - ${supplierName}`;
    let body = `Estimado ${supplierName},\n\nAdjunto nuestra orden de compra:\n\n`;
    order.items.forEach((item) => {
      body += `• ${item.sku} - ${item.name}: ${item.quantity}x ${formatCurrency(item.unit_cost)}\n`;
    });
    body += `\nTOTAL: ${formatCurrency(order.total_cost)}\n\nSaludos,\nBRAKE FILTER`;
    const supplier = suppliers.find(s => s.id === order.supplier_id);
    const email = supplier?.email || '';
    const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
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

              {/* Action buttons row - always show edit/download/share */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 flex-wrap">
                {order.status === 'pendiente' && (
                  <>
                    <select
                      value={selectedSupplier[order.id] || order.supplier_id || ''}
                      onChange={(e) => setSelectedSupplier({ ...selectedSupplier, [order.id]: e.target.value })}
                      className="flex-1 min-w-[120px] px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 bg-white"
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
                  </>
                )}
                {order.status === 'enviada' && (
                  <button
                    onClick={() => handleReceive(order)}
                    disabled={processing === order.id}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {processing === order.id ? 'Procesando...' : 'Marcar como Recibida (suma stock)'}
                  </button>
                )}
                {order.status === 'recibida' && (
                  <div className="flex-1 flex items-center gap-1.5 text-xs text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    Stock ingresado a bodega
                  </div>
                )}
                {/* Edit / Download / Share buttons */}
                <button
                  onClick={() => openEdit(order)}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                  title="Editar orden"
                >
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
                <button
                  onClick={() => handleDownloadPDF(order)}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                  title="Descargar orden"
                >
                  <FileText className="w-3.5 h-3.5" /> PDF
                </button>
                <button
                  onClick={() => handleShare(order)}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                  title="Compartir por WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </button>
                <button
                  onClick={() => handleShareEmail(order)}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                  title="Compartir por Email"
                >
                  <Mail className="w-3.5 h-3.5" /> Email
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingOrder && (
        <div
          className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-3 sm:p-4 animate-fade-in"
          onClick={() => setEditingOrder(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-slate-900">Editar Orden de Compra</h3>
              </div>
              <button onClick={() => setEditingOrder(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Supplier select */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Proveedor</label>
                <select
                  value={editSupplierId}
                  onChange={(e) => setEditSupplierId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 bg-white"
                >
                  <option value="">Sin proveedor</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Items */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Productos</label>
                <div className="space-y-2">
                  {editItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{item.sku} — {item.name}</p>
                      </div>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateEditItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                        min={1}
                        className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500/30"
                        title="Cantidad"
                      />
                      <input
                        type="number"
                        value={item.unit_cost}
                        onChange={(e) => updateEditItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                        min={0}
                        step="any"
                        className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500/30"
                        title="Costo unitario"
                      />
                      <button
                        onClick={() => removeEditItem(idx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Total: {formatCurrency(editItems.reduce((sum, i) => sum + i.unit_cost * i.quantity, 0))}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditingOrder(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveEdit}
                  disabled={savingEdit}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
