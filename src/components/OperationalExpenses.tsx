import { useState } from 'react';
import { Plus, X, Trash2, Receipt, Calendar, Repeat, TrendingDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/ToastContainer';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { OperationalExpense, ExpenseFrequency } from '@/types';

interface OperationalExpensesProps {
  expenses: OperationalExpense[];
  onRefresh: () => void;
}

const EXPENSE_CATEGORIES = [
  'Embalaje',
  'Arriendo',
  'Servicios',
  'Insumos de Taller',
  'Mantención',
  'Transporte',
  'Marketing',
  'Otros',
];

export function OperationalExpenses({ expenses, onRefresh }: OperationalExpensesProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'Embalaje',
    amount: 0,
    expense_date: new Date().toISOString().split('T')[0],
    frequency: 'puntual' as ExpenseFrequency,
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const totalMonthly = expenses
    .filter((e) => e.frequency === 'mensual')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalPunctual = expenses
    .filter((e) => e.frequency === 'puntual')
    .reduce((sum, e) => sum + e.amount, 0);

  const sorted = [...expenses].sort(
    (a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime(),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.amount <= 0) return;
    setSaving(true);

    const { error } = await supabase.from('operational_expenses').insert({
      name: form.name.trim(),
      category: form.category,
      amount: form.amount,
      expense_date: form.expense_date,
      frequency: form.frequency,
      notes: form.notes || null,
    });

    setSaving(false);
    if (error) {
      showToast(`Error: ${error.message}`, 'error');
      return;
    }

    showToast('Gasto registrado', 'success');
    setForm({
      name: '',
      category: 'Embalaje',
      amount: 0,
      expense_date: new Date().toISOString().split('T')[0],
      frequency: 'puntual',
      notes: '',
    });
    setShowForm(false);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    const { error } = await supabase.from('operational_expenses').delete().eq('id', id);
    if (error) {
      showToast('Error al eliminar', 'error');
    } else {
      showToast('Gasto eliminado', 'success');
      onRefresh();
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Gastos Puntuales
            </p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">
            {formatCurrency(totalPunctual)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {expenses.filter((e) => e.frequency === 'puntual').length} registros
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <Repeat className="w-4 h-4 text-amber-500" />
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Gastos Mensuales
            </p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">
            {formatCurrency(totalMonthly)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Costo recurrente mensual</p>
        </div>
      </div>

      {/* Add Button */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          {expenses.length} gasto{expenses.length !== 1 ? 's' : ''} registrado{expenses.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo Gasto
        </button>
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            No hay gastos registrados. Registra insumos, arriendo, servicios, etc.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((exp) => (
            <div
              key={exp.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex items-center gap-3 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex-shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800 truncate">{exp.name}</span>
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {exp.category}
                  </span>
                  {exp.frequency === 'mensual' && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                      MENSUAL
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                  <Calendar className="w-3 h-3" />
                  {formatDate(exp.expense_date)}
                  {exp.notes && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span className="truncate italic">{exp.notes}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base font-bold text-red-600">-{formatCurrency(exp.amount)}</p>
                <button
                  onClick={() => handleDelete(exp.id)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600 transition-all"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-3 sm:p-4 animate-fade-in"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-slate-900">Nuevo Gasto Operativo</h3>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                  placeholder="Ej: Cajas de embalaje x100"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 bg-white"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Monto ($) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                    min={0}
                    step="any"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={form.expense_date}
                    onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Frecuencia</label>
                  <select
                    value={form.frequency}
                    onChange={(e) =>
                      setForm({ ...form, frequency: e.target.value as ExpenseFrequency })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 bg-white"
                  >
                    <option value="puntual">Puntual</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
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
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Registrar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
