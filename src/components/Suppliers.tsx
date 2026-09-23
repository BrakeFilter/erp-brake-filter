import { useState } from 'react';
import { Building2, Plus, X, Trash2, Pencil, Phone, Mail, MapPin, User, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/ToastContainer';
import type { Supplier } from '@/types';

interface SuppliersProps {
  suppliers: Supplier[];
  onRefresh: () => void;
}

interface FormState {
  id?: string;
  name: string;
  rut: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
}

const emptyForm: FormState = { name: '', rut: '', contact_name: '', phone: '', email: '', address: '' };

export function Suppliers({ suppliers, onRefresh }: SuppliersProps) {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Supplier | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setEditItem(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (s: Supplier) => {
    setEditItem(s);
    setForm({ id: s.id, name: s.name, rut: s.rut || '', contact_name: s.contact_name || '', phone: s.phone || '', email: s.email || '', address: s.address || '' });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      rut: form.rut.trim() || null,
      contact_name: form.contact_name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
    };
    if (form.id) {
      const { error } = await supabase.from('suppliers').update(payload).eq('id', form.id);
      if (error) { showToast(`Error: ${error.message}`, 'error'); setSaving(false); return; }
      showToast('Proveedor actualizado', 'success');
    } else {
      const { error } = await supabase.from('suppliers').insert(payload);
      if (error) { showToast(`Error: ${error.message}`, 'error'); setSaving(false); return; }
      showToast('Proveedor creado', 'success');
    }
    setSaving(false); setShowForm(false); onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este proveedor?')) return;
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) { showToast('Error al eliminar', 'error'); }
    else { showToast('Proveedor eliminado', 'success'); onRefresh(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{suppliers.length} proveedor{suppliers.length !== 1 ? 'es' : ''}</p>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Nuevo Proveedor
        </button>
      </div>

      {suppliers.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No hay proveedores registrados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {suppliers.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-all group">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-50 text-red-600 flex-shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
                  {s.rut && <p className="text-xs text-slate-400">RUT: {s.rut}</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                {s.contact_name && <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-400" /> {s.contact_name}</div>}
                {s.phone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /> {s.phone}</div>}
                {s.email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" /> <span className="truncate">{s.email}</span></div>}
                {s.address && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> <span className="truncate">{s.address}</span></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-3 sm:p-4 animate-fade-in" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-slate-900">{editItem ? 'Editar' : 'Nuevo'} Proveedor</h3>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                  placeholder="Distribuidora AutoParts" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">RUT</label>
                <input type="text" value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                  placeholder="76.123.456-7" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Contacto</label>
                <input type="text" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                  placeholder="Juan Pérez" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono</label>
                  <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                    placeholder="+56 9 1234 5678" autoComplete="off" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                    placeholder="ventas@auto.cl" autoComplete="off" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dirección</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                  placeholder="Av. Industrial 123, Santiago" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
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
