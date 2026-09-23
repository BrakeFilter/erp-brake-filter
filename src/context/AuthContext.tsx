import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { CompanySettings } from '@/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  companySettings: CompanySettings | null;
  signOut: () => Promise<void>;
  refreshCompanySettings: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

  const fetchCompanySettings = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error loading company settings:', error.message);
      return;
    }

    if (data) {
      setCompanySettings(data as CompanySettings);
    } else {
      // Create default settings for new user
      const { data: newSettings, error: insertError } = await supabase
        .from('company_settings')
        .insert({
          company_name: 'BRAKE FILTER',
          primary_color: '#DC2626',
          font_family: 'Inter',
          active_modules: {
            inventario: true,
            facturacion: true,
            historial: true,
            costos: true,
            metricas: true,
            vehiculos: true,
            proveedores: true,
            ordenes: true,
            ajustes: true,
          },
          user_id: userId,
        })
        .select('*')
        .single();

      if (!insertError && newSettings) {
        setCompanySettings(newSettings as CompanySettings);
      }
    }
  }, []);

  const refreshCompanySettings = useCallback(async () => {
    if (user) {
      await fetchCompanySettings(user.id);
    }
  }, [user, fetchCompanySettings]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setCompanySettings(null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchCompanySettings(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await fetchCompanySettings(newSession.user.id);
        } else {
          setCompanySettings(null);
        }
        setLoading(false);
      })();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchCompanySettings]);

  return (
    <AuthContext.Provider
      value={{ session, user, loading, companySettings, signOut, refreshCompanySettings }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
