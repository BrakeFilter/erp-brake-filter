import { Search, ScanLine, FileSpreadsheet, Download, Upload } from 'lucide-react';
import { useRef } from 'react';

interface SearchAndActionsProps {
  search: string;
  onSearchChange: (val: string) => void;
  onScanClick: () => void;
  onImportClick: () => void;
  onExportClick: () => void;
  onTemplateClick: () => void;
  scanActive: boolean;
}

export function SearchAndActions({
  search,
  onSearchChange,
  onScanClick,
  onImportClick,
  onExportClick,
  onTemplateClick,
  scanActive,
}: SearchAndActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por SKU, nombre, código de barras, marca o ubicación..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 transition-all"
          inputMode="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={onScanClick}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            scanActive
              ? 'bg-red-600 text-white animate-pulse-red'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          <ScanLine className="w-4 h-4" />
          <span className="hidden sm:inline">Escanear</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all whitespace-nowrap"
        >
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">Importar</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onImportClick();
              fileInputRef.current!.value = '';
            }
          }}
        />

        <button
          onClick={onExportClick}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all whitespace-nowrap"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span className="hidden sm:inline">Excel</span>
        </button>

        <button
          onClick={onTemplateClick}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all whitespace-nowrap"
          title="Descargar plantilla modelo"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Plantilla</span>
        </button>
      </div>
    </div>
  );
}
