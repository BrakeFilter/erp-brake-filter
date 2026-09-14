import { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRightCircle,
  FileUp,
  Calendar,
} from 'lucide-react';
import type { Invoice, InvoiceStatus } from '@/types';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, daysUntil } from '@/lib/utils';
import { showToast } from '@/components/ToastContainer';

interface InvoiceModuleProps {
  invoices: Invoice[];
  onRefresh: () => void;
}

type SortOrder = 'recent' | 'old';

export function InvoiceModule({ invoices, onRefresh }: InvoiceModuleProps) {
  const [subTab, setSubTab] = useState<InvoiceStatus>('por_pagar');
  const [showForm, setShowForm] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');

  const pending = invoices.filter((i) => i.status === 'por_pagar');
  const paid = invoices.filter((i) => i.status === 'pagado');

  const totalPending = pending.reduce((sum, i) => sum + i.amount_total, 0);
  const dueSoon = pending.filter((i) => {
    const days = daysUntil(i.due_date);
    return days >= 0 && days <= 7;
  }).length;
  const overdue = pending.filter((i) => daysUntil(i.due_date) < 0).length;

  const filtered = [...(subTab === 'por_pagar' ? pending : paid)].sort((a, b) => {
    const da = new Date(a.issue_date).getTime();
    const db = new Date(b.issue_date).getTime();
    return sortOrder === 'recent' ? db - da : da - db;
  });

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-red-500" />
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Por Pagar
            </p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">
            {formatCurrency(totalPending)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">{pending.length} facturas pendientes</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Vencen en ≤ 7 días
            </p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-xl sm:text-2xl font-bold text-amber-600">{dueSoon}</p>
            {overdue > 0 && (
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                {overdue} vencida{overdue !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Requiere atención urgente</p>
        </div>
      </div>

      {/* Sub-tabs + Actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setSubTab('por_pagar')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-all ${
              subTab === 'por_pagar' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600'
            }`}
          >
            Por Pagar
            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">
              {pending.length}
            </span>
          </button>
          <button
            onClick={() => setSubTab('pagado')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-all ${
              subTab === 'pagado' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-600'
            }`}
          >
            Pagadas
            <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-bold">
              {paid.length}
            </span>
          </button>
        </div>

        <div className="flex gap-2">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/30"
          >
            <option value="recent">Más reciente</option>
            <option value="old">Más antigua</option>
          </select>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nueva Factura</span>
          </button>
        </div>
      </div>

      {/* Invoice List */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">
              No hay facturas {subTab === 'por_pagar' ? 'por pagar' : 'pagadas'}
            </p>
          </div>
        ) : (
          filtered.map((inv) => {
            const days = daysUntil(inv.due_date);
            const isOverdue = inv.status === 'por_pagar' && days < 0;
            const isDueSoon = inv.status === 'por_pagar' && days >= 0 && days <= 7;

            return (
              <div
                key={inv.id}
                className={`bg-white rounded-xl border shadow-sm p-4 flex items-center gap-3 transition-all hover:shadow-md ${
                  isOverdue ? 'border-red-300' : isDueSoon ? 'border-amber-300' : 'border-slate-200'
                }`}
              >
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 ${
                    inv.status === 'pagado'
                      ? 'bg-green-100 text-green-600'
                      : isOverdue
                        ? 'bg-red-100 text-red-600'
                        : 'bg-amber-100 text-amber-600'
                  }`}
                >
                  {inv.status === 'pagado' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <FileText className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">#{inv.folio}</span>
                    {inv.status === 'pagado' ? (
                      <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded border border-green-200">
                        PAGADO
                      </span>
                    ) : isOverdue ? (
                      <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-200 animate-pulse">
                        VENCIDA ({Math.abs(days)} días)
                      </span>
                    ) : isDueSoon ? (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                        VENCE EN {days}d
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        POR PAGAR
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{inv.supplier}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {formatDate(inv.issue_date)}
                    </span>
                    <span>→ Vence: {formatDate(inv.due_date)}</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-base font-bold text-slate-900">
                    {formatCurrency(inv.amount_total)}
                  </p>
                  {inv.status === 'por_pagar' && (
                    <button
                      onClick={async () => {
                        const { error } = await supabase
                          .from('invoices')
                          .update({ status: 'pagado', updated_at: new Date().toISOString() })
                          .eq('id', inv.id);
                        if (error) {
                          showToast('Error al actualizar factura', 'error');
                        } else {
                          showToast('Factura marcada como pagada', 'success');
                          onRefresh();
                        }
                      }}
                      className="mt-1 flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 ml-auto"
                    >
                      <ArrowRightCircle className="w-3.5 h-3.5" />
                      Marcar pagada
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showForm && (
        <InvoiceFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

interface InvoiceFormModalProps {
  onClose: () => void;
  onSaved: () => void;
}

function InvoiceFormModal({ onClose, onSaved }: InvoiceFormModalProps) {
  const [form, setForm] = useState({
    folio: '',
    supplier: '',
    amount_total: 0,
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date().toISOString().split('T')[0],
    attachment_url: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      due_date: prev.issue_date,
    }));
  }, [form.issue_date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.folio.trim() || !form.supplier.trim()) return;
    setSaving(true);

    const { error } = await supabase.from('invoices').insert({
      folio: form.folio.trim(),
      supplier: form.supplier.trim(),
      amount_total: form.amount_total,
      issue_date: form.issue_date,
      due_date: form.due_date,
      status: 'por_pagar',
      attachment_url: form.attachment_url || null,
      notes: form.notes || null,
    });

    setSaving(false);
    if (error) {
      showToast(`Error: ${error.message}`, 'error');
    } else {
      showToast('Factura registrada correctamente', 'success');
      onSaved();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-slate-900">Nueva Factura</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Folio / Número <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.folio}
                onChange={(e) => setForm({ ...form, folio: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                placeholder="Ej: 12345"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Monto Total <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.amount_total}
                onChange={(e) =>
                  setForm({ ...form, amount_total: parseFloat(e.target.value) || 0 })
                }
                min={0}
                step="any"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Proveedor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
              placeholder="Nombre del proveedor"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Fecha Emisión
              </label>
              <input
                type="date"
                value={form.issue_date}
                onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Fecha Vencimiento
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              URL del Comprobante (PDF/Imagen)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={form.attachment_url}
                onChange={(e) => setForm({ ...form, attachment_url: e.target.value })}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                placeholder="https://..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setFileName(null)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
              >
                <FileUp className="w-4 h-4" />
                {fileName || 'Examinar'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Pega la URL del documento o adjunta el archivo
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 resize-none"
              placeholder="Observaciones..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Registrar Factura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
