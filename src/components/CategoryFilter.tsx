import { useState } from 'react';
import { Plus, Settings2, X, Trash2 } from 'lucide-react';
import type { Category } from '@/types';

interface CategoryFilterProps {
  categories: Category[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
}

export function CategoryFilter({
  categories,
  selected,
  onSelect,
  onCreate,
  onDelete,
}: CategoryFilterProps) {
  const [showManager, setShowManager] = useState(false);
  const [newName, setNewName] = useState('');

  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-1">
          <button
            onClick={() => onSelect(null)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              selected === null
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            Todos
          </button>
          {sorted.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                selected === cat.id
                  ? 'bg-red-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => setShowManager(true)}
        className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all"
        title="Gestionar categorías"
      >
        <Settings2 className="w-4 h-4" />
      </button>

      {showManager && (
        <div
          className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowManager(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Gestionar Categorías</h3>
              <button onClick={() => setShowManager(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {sorted.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No hay categorías</p>
              )}
              {sorted.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <span className="text-sm text-slate-700">{cat.name}</span>
                  <button
                    onClick={() => onDelete(cat.id)}
                    className="text-red-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-200 flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nueva categoría..."
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <button
                onClick={() => {
                  const trimmed = newName.trim();
                  if (trimmed) {
                    onCreate(trimmed);
                    setNewName('');
                  }
                }}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
