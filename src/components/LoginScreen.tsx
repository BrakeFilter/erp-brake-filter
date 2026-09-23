import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/ToastContainer';
import { Disc, Wrench, Mail, Lock, LogIn, UserPlus, Loader2 } from 'lucide-react';

export function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'BRAKE FILTER — Iniciar Sesión';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        showToast(`Error: ${error.message}`, 'error');
        setSubmitting(false);
        return;
      }
      showToast('Sesión iniciada', 'success');
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) {
        showToast(`Error: ${error.message}`, 'error');
        setSubmitting(false);
        return;
      }
      if (data.user) {
        showToast('Cuenta creada. Bienvenido a BRAKE FILTER.', 'success');
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative flex items-center justify-center w-16 h-16 rounded-xl bg-red-600 shadow-lg mb-4">
            <Disc className="w-9 h-9 text-white" />
            <Wrench className="w-5 h-5 text-white absolute bottom-1 right-1" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">BRAKE FILTER</h1>
          <p className="text-xs text-slate-400 font-medium tracking-wider uppercase mt-1">
            Control de Bodega &amp; ERP
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-5">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'login' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              <LogIn className="w-4 h-4" />
              Ingresar
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'signup' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Crear Cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                  placeholder="tu@email.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'login' ? (
                <LogIn className="w-4 h-4" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-4">
            {mode === 'login'
              ? '¿No tienes cuenta? Cambia a "Crear Cuenta"'
              : 'La cuenta se crea con email y contraseña (mín. 6 caracteres)'}
          </p>
        </div>
      </div>
    </div>
  );
}
