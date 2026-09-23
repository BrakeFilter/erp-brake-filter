import { Disc, Wrench, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface HeaderProps {
  onNavigateSettings?: () => void;
}

export function Header({ onNavigateSettings }: HeaderProps) {
  const { companySettings, signOut, user } = useAuth();

  const companyName = companySettings?.company_name || 'BRAKE FILTER';
  const logoUrl = companySettings?.logo_url || null;

  return (
    <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <div className="relative flex items-center justify-center w-11 h-11 rounded-lg bg-red-600 shadow-md overflow-hidden flex-shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="w-full h-full object-cover" />
          ) : (
            <>
              <Disc className="w-6 h-6 text-white" />
              <Wrench className="w-4 h-4 text-white absolute bottom-0 right-0" />
            </>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight leading-tight truncate">
            {companyName}
          </h1>
          <p className="text-[10px] sm:text-xs text-slate-400 font-medium tracking-wider uppercase">
            Control de Bodega &amp; ERP
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Tiempo Real
          </span>
          {user && (
            <span className="hidden md:inline text-xs text-slate-400 truncate max-w-[150px]">
              {user.email}
            </span>
          )}
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 text-slate-300 hover:bg-red-600 hover:text-white transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}
