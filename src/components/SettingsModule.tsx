import { useState } from 'react';
import { Settings, User, Shield, Palette, Save, Upload, Link2, Building2, Check, Smartphone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/ToastContainer';
import { useAuth } from '@/context/AuthContext';
import { setMlCommissionPercent } from '@/lib/mercadolibre';

type SubTab = 'cuenta' | 'seguridad' | 'personalizacion' | 'apariencia';

const MODULE_LABELS: Record<string, string> = {
  inventario: 'Inventario',
  facturacion: 'Facturación',
  historial: 'Movimientos',
  costos: 'Costos e Insumos',
  metricas: 'Métricas & Reportes',
  vehiculos: 'Tipos y Costos de Envío',
  proveedores: 'Proveedores',
  ordenes: 'Órdenes de Compra',
  ajustes: 'Ajustes',
};

const FONT_OPTIONS = ['Inter', 'Roboto', 'system-ui', 'Arial', 'Helvetica'];

function updateManifestIcons(logoUrl: string | null) {
  try {
    const manifestEl = document.querySelector('link[rel="manifest"]');
    if (!manifestEl) return;

    // Build a dynamic manifest with custom icons if logo exists
    const manifest: Record<string, unknown> = {
      name: 'BrakeFilter ERP',
      short_name: 'BrakeFilter',
      description: 'ERP Filtros y Lubricantes',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      display_override: ['window-controls-overlay', 'standalone'],
      background_color: '#ffffff',
      theme_color: '#0f172a',
      orientation: 'portrait-primary',
      icons: logoUrl
        ? [
            { src: logoUrl, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: logoUrl, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ]
        : [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
    };

    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    manifestEl.setAttribute('href', url);

    // Update apple-touch-icon
    const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (appleIcon) {
      appleIcon.setAttribute('href', logoUrl || '/icon-192.png');
    }

    // Update favicon
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) {
      favicon.setAttribute('href', logoUrl || '/icon-192.png');
    }
  } catch { /* ignore */ }
}

export function SettingsModule() {
  const { user, companySettings, refreshCompanySettings } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>('cuenta');
  const [saving, setSaving] = useState(false);

  // Cuenta
  const [companyName, setCompanyName] = useState(companySettings?.company_name || 'BRAKE FILTER');
  const [logoUrl, setLogoUrl] = useState(companySettings?.logo_url || '');
  const [uploading, setUploading] = useState(false);
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');

  // Apariencia — App Logo
  const [appLogoUrl, setAppLogoUrl] = useState(companySettings?.app_logo_url || '');
  const [uploadingAppLogo, setUploadingAppLogo] = useState(false);

  // Seguridad
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Personalización
  const [primaryColor, setPrimaryColor] = useState(companySettings?.primary_color || '#DC2626');
  const [fontFamily, setFontFamily] = useState(companySettings?.font_family || 'Inter');
  const [activeModules, setActiveModules] = useState<Record<string, boolean>>(
    companySettings?.active_modules || {},
  );
  const [mlCommission, setMlCommission] = useState(companySettings?.ml_commission_percent || 13.5);

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { showToast('Debe ser una imagen', 'error'); return; }
    if (file.size > 2 * 1024 * 1024) { showToast('Máximo 2MB', 'error'); return; }
    setUploading(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const fileName = `logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('product-images').upload(`logos/${fileName}`, file);
    if (upErr) { showToast(`Error: ${upErr.message}`, 'error'); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(`logos/${fileName}`);
    setLogoUrl(urlData.publicUrl);
    showToast('Logo subido', 'success');
    setUploading(false);
  };

  const handleAppLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { showToast('Debe ser una imagen PNG', 'error'); return; }
    if (file.size > 2 * 1024 * 1024) { showToast('Máximo 2MB', 'error'); return; }
    setUploadingAppLogo(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const fileName = `app-logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('app-assets').upload(`app-logo.png`, file, { upsert: true });
    if (upErr) { showToast(`Error: ${upErr.message}`, 'error'); setUploadingAppLogo(false); return; }
    const { data: urlData } = supabase.storage.from('app-assets').getPublicUrl(`app-logo.png`);
    setAppLogoUrl(urlData.publicUrl);
    updateManifestIcons(urlData.publicUrl);
    showToast('Logo de la app subido — manifest actualizado', 'success');
    setUploadingAppLogo(false);
  };

  const saveCuenta = async () => {
    if (!companySettings) return;
    setSaving(true);
    const { error } = await supabase
      .from('company_settings')
      .update({ company_name: companyName, logo_url: logoUrl || null, updated_at: new Date().toISOString() })
      .eq('id', companySettings.id);
    if (error) { showToast(`Error: ${error.message}`, 'error'); }
    else { showToast('Datos de empresa guardados', 'success'); await refreshCompanySettings(); }
    setSaving(false);
  };

  const saveApariencia = async () => {
    if (!companySettings) return;
    setSaving(true);
    const { error } = await supabase
      .from('company_settings')
      .update({ app_logo_url: appLogoUrl || null, updated_at: new Date().toISOString() })
      .eq('id', companySettings.id);
    if (error) { showToast(`Error: ${error.message}`, 'error'); }
    else {
      showToast('Logo de la app guardado', 'success');
      await refreshCompanySettings();
      updateManifestIcons(appLogoUrl || null);
    }
    setSaving(false);
  };

  const saveSeguridad = async () => {
    setSaving(true);
    if (newEmail.trim() && newEmail.trim() !== user?.email) {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) { showToast(`Error email: ${error.message}`, 'error'); setSaving(false); return; }
      showToast('Email actualizado. Revisa tu correo para confirmar.', 'success');
    }
    if (newPassword.trim() && newPassword.length >= 6) {
      const { error } = await supabase.auth.updateUser({ password: newPassword.trim() });
      if (error) { showToast(`Error contraseña: ${error.message}`, 'error'); setSaving(false); return; }
      showToast('Contraseña actualizada', 'success');
      setNewPassword('');
    }
    if (!newEmail.trim() && !newPassword.trim()) {
      showToast('No hay cambios para guardar', 'info');
    }
    setSaving(false);
  };

  const savePersonalizacion = async () => {
    if (!companySettings) return;
    setSaving(true);
    const { error } = await supabase
      .from('company_settings')
      .update({
        primary_color: primaryColor,
        font_family: fontFamily,
        active_modules: activeModules,
        ml_commission_percent: mlCommission,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companySettings.id);
    if (error) { showToast(`Error: ${error.message}`, 'error'); }
    else {
      showToast('Personalización guardada', 'success');
      setMlCommissionPercent(mlCommission);
      await refreshCompanySettings();
    }
    setSaving(false);
  };

  const subTabs: Array<{ key: SubTab; label: string; icon: typeof User }> = [
    { key: 'cuenta', label: 'Cuenta', icon: User },
    { key: 'seguridad', label: 'Seguridad', icon: Shield },
    { key: 'personalizacion', label: 'Personalización', icon: Palette },
    { key: 'apariencia', label: 'Apariencia', icon: Smartphone },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 flex-wrap">
        {subTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setSubTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                subTab === t.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}>
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Cuenta */}
      {subTab === 'cuenta' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 max-w-lg">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-slate-900">Datos de la Empresa</h3>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre de la Empresa</label>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Logo de la Empresa</label>
            <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg w-fit mb-2">
              <button type="button" onClick={() => setImageMode('upload')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${imageMode === 'upload' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}>
                <Upload className="w-3 h-3" /> Subir
              </button>
              <button type="button" onClick={() => setImageMode('url')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${imageMode === 'url' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}>
                <Link2 className="w-3 h-3" /> URL
              </button>
            </div>
            {imageMode === 'upload' ? (
              <input type="file" accept="image/*" disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.currentTarget.value = ''; }}
                className="text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-red-600 file:text-white file:text-xs file:font-medium file:cursor-pointer" />
            ) : (
              <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                placeholder="https://..." autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
            )}
            {logoUrl && <img src={logoUrl} alt="Logo" className="mt-2 w-16 h-16 rounded-lg object-cover border border-slate-200" />}
          </div>
          <button onClick={saveCuenta} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      )}

      {/* Seguridad */}
      {subTab === 'seguridad' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 max-w-lg">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-slate-900">Seguridad de la Cuenta</h3>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email Actual</label>
            <input type="email" value={user?.email || ''} disabled
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nuevo Email</label>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
              placeholder="nuevo@email.com" autoComplete="off" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nueva Contraseña (mín. 6 caracteres)</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
              placeholder="••••••••" autoComplete="new-password" />
          </div>
          <button onClick={saveSeguridad} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Actualizar Credenciales'}
          </button>
        </div>
      )}

      {/* Personalización */}
      {subTab === 'personalizacion' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5 max-w-lg">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-slate-900">Personalización</h3>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-600 flex-shrink-0">Color Primario</label>
            <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer" />
            <span className="text-sm text-slate-400 font-mono">{primaryColor}</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fuente</label>
            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 bg-white">
              {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Comisión Mercado Libre (%) — Default: 13.5%
            </label>
            <input type="number" value={mlCommission} onChange={(e) => setMlCommission(parseFloat(e.target.value) || 13.5)}
              min={0} max={50} step="0.1"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
              placeholder="13.5" />
            <p className="text-[11px] text-slate-400 mt-1">Se usa en el cálculo de ventas ML en el modal de venta.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Módulos Activos</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(MODULE_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={activeModules[key] !== false}
                    onChange={(e) => setActiveModules({ ...activeModules, [key]: e.target.checked })}
                    className="rounded" />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <button onClick={savePersonalizacion} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar Personalización'}
          </button>
        </div>
      )}

      {/* Apariencia — App Logo */}
      {subTab === 'apariencia' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5 max-w-lg">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-slate-900">Apariencia — Logo de la App</h3>
          </div>
          <p className="text-sm text-slate-500">
            Sube un logo cuadrado (PNG recomendado). Este logo reemplaza el icono de la app instalable (PWA)
            en Android, el header del ERP, y el icono de inicio. Si no subes nada, se usa el logo por defecto.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Logo de la App (PNG cuadrado)</label>
            <input type="file" accept="image/png,image/jpeg" disabled={uploadingAppLogo}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAppLogoUpload(f); e.currentTarget.value = ''; }}
              className="text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-red-600 file:text-white file:text-xs file:font-medium file:cursor-pointer" />
            {uploadingAppLogo && <p className="text-xs text-slate-400 mt-1">Subiendo...</p>}
          </div>
          {appLogoUrl && (
            <div className="flex items-center gap-3">
              <img src={appLogoUrl} alt="App Logo" className="w-20 h-20 rounded-xl object-cover border-2 border-slate-200 shadow-sm" />
              <div>
                <p className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Logo activo</p>
                <button onClick={() => { setAppLogoUrl(''); updateManifestIcons(null); }}
                  className="text-xs text-red-500 hover:text-red-600 mt-1">
                  Quitar logo (usar default)
                </button>
              </div>
            </div>
          )}
          <button onClick={saveApariencia} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar Logo de la App'}
          </button>
        </div>
      )}
    </div>
  );
}
