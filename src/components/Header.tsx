import { Disc, Wrench } from 'lucide-react';
import { tenantConfig } from '@/config/tenantConfig';

export function Header() {
  return (
    <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <div className="relative flex items-center justify-center w-11 h-11 rounded-lg bg-red-600 shadow-md">
          <Disc className="w-6 h-6 text-white" />
          <Wrench className="w-4 h-4 text-white absolute bottom-0 right-0" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight leading-tight">
            {tenantConfig.companyName}
          </h1>
          <p className="text-[10px] sm:text-xs text-slate-400 font-medium tracking-wider uppercase">
            {tenantConfig.subtitle}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Tiempo Real
          </span>
        </div>
      </div>
    </header>
  );
}
