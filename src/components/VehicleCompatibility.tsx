import { useState, useMemo } from 'react';
import { Car, Plus, X, Trash2, Search, Pencil, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/ToastContainer';
import type { VehicleCompatibility, Product } from '@/types';

interface VehicleCompatibilityProps {
  compatibilities: VehicleCompatibility[];
  products: Product[];
  onRefresh: () => void;
}

interface FormState {
  id?: string;
  product_id: string;
  brand: string;
  model: string;
  year_from: number;
  year_to: number;
  engine: string;
}

const emptyForm: FormState = {
  product_id: '',
  brand: '',
  model: '',
  year_from: 2000,
  year_to: 2024,
  engine: '',
};

export function VehicleCompatibility({ compatibilities, products, onRefresh }: VehicleCompatibilityProps) {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<VehicleCompatibility | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState({ brand: '', model: '', year: '' });

  const filtered = useMemo(() => {
    return compatibilities.filter((c) => {
      if (search.brand && !c.brand.toLowerCase().includes(search.brand.toLowerCase())) return false;
      if (search.model && !c.model.toLowerCase().includes(search.model.toLowerCase())) return false;
      if (search.year) {
        const y = parseInt(search.year);
        if (y && !(y >= c.year_from && y <= c.year_to)) return false;
      }
      return true;
    });
  }, [compatibilities, search]);

  const openAdd = () => {
    setEditItem(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (item: VehicleCompatibility) => {
    setEditItem(item);
    setForm({
      id: item.id,
      product_id: item.product_id,
      brand: item.brand,
      model: item.model,
      year_from: item.year_from,
      year_to: item.year_to,
      engine: item.engine || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_id || !form.brand.trim() || !form.model.trim()) {
      showToast('Completa marca, modelo y producto', 'error');
      return;
    }
    setSaving(true);

    const payload = {
      product_id: form.product_id,
      brand: form.brand.trim(),
      model: form.model.trim(),
      year_from: form.year_from,
      year_to: form.year_to,
      engine: form.engine.trim() || null,
    };

    if (form.id) {
      const { error } = await supabase.from('vehicle_compatibilities').update(payload).eq('id', form.id);
      if (error) {
        showToast(`Error: ${error.message}`, 'error');
        setSaving(false);
        return;
      }
      showToast('Compatibilidad actualizada', 'success');
    } else {
      const { error } = await supabase.from('vehicle_compatibilities').insert(payload);
      if (error) {
        showToast(`Error: ${error.message}`, 'error');
        setSaving(false);
        return;
      }
      showToast('Compatibilidad agregada', 'success');
    }

    setSaving(false);
    setShowForm(false);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta compatibilidad?')) return;
    const { error } = await supabase.from('vehicle_compatibilities').delete().eq('id', id);
    if (error) {
      showToast('Error al eliminar', 'error');
    } else {
      showToast('Compatibilidad eliminada', 'success');
      onRefresh();
    }
  };

  const getProduct = (pid: string) => products.find((p) => p.id === pid);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          {filtered.length} compatibilidad{filtered.length !== 1 ? 'es' : ''}
        </p>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Agregar Compatibilidad
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-slate-400" />
          <p className="text-sm font-medium text-slate-600">Buscar por vehículo</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <input
            type="text"
            value={search.brand}
            onChange={(e) => setSearch({ ...search, brand: e.target.value })}
            placeholder="Marca"
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          />
          <input
            type="text"
            value={search.model}
            onChange={(e) => setSearch({ ...search, model: e.target.value })}
            placeholder="Modelo"
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          />
          <input
            type="number"
            value={search.year}
            onChange={(e) => setSearch({ ...search, year: e.target.value })}
            placeholder="Año"
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
            autoComplete="off"
          />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Car className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No hay compatibilidades registradas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const prod = getProduct(c.product_id);
            return (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex items-center gap-3 hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-50 text-red-600 flex-shrink-0">
                  <Car className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {c.brand} {c.model} {c.year_from}-{c.year_to}
                    {c.engine && <span className="text-slate-500 font-normal"> {c.engine}</span>}
                  </p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Package className="w-3 h-3" />
                    {prod ? `${prod.name} — SKU: ${prod.sku}` : 'Producto no encontrado'}
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(c)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
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
                <Car className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-slate-900">
                  {editItem ? 'Editar' : 'Agregar'} Compatibilidad
                </h3>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Producto <span className="text-red-500">*</span></label>
                <select
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 bg-white"
                >
                  <option value="">Seleccionar producto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Marca <span className="text-red-500">*</span></label>
                  <input
                    type="text" value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                    placeholder="Toyota"
                    autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Modelo <span className="text-red-500">*</span></label>
                  <input
                    type="text" value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                    placeholder="Hilux"
                    autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Año Desde</label>
                  <input
                    type="number" value={form.year_from}
                    onChange={(e) => setForm({ ...form, year_from: parseInt(e.target.value) || 2000 })}
                    min={1900} max={2030}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Año Hasta</label>
                  <input
                    type="number" value={form.year_to}
                    onChange={(e) => setForm({ ...form, year_to: parseInt(e.target.value) || 2024 })}
                    min={1900} max={2030}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Motor</label>
                <input
                  type="text" value={form.engine}
                  onChange={(e) => setForm({ ...form, engine: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                  placeholder="2.4 D4D"
                  autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
