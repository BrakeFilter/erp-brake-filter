import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth, AuthProvider } from '@/context/AuthContext';
import type {
  Product, Category, Invoice, Movement, OperationalExpense,
  VehicleCompatibility, Supplier, PurchaseOrder, PurchaseOrderItem, TabKey,
} from '@/types';
import { Header } from '@/components/Header';
import { ToastContainer, showToast } from '@/components/ToastContainer';
import { LoginScreen } from '@/components/LoginScreen';
import { InventoryTab } from '@/components/InventoryTab';
import { InvoiceModule } from '@/components/InvoiceModule';
import { MovementHistory } from '@/components/MovementHistory';
import { OperationalExpenses } from '@/components/OperationalExpenses';
import { MetricsDashboard } from '@/components/MetricsDashboard';
import { VehicleCompatibility as VehicleModule } from '@/components/VehicleCompatibility';
import { Suppliers } from '@/components/Suppliers';
import { PurchaseOrders } from '@/components/PurchaseOrders';
import { SettingsModule } from '@/components/SettingsModule';
import {
  Boxes, FileText, History, Receipt, BarChart3, Car, Building2, ClipboardList, Settings,
} from 'lucide-react';

const PAGE_SIZE = 1000;

function AppInner() {
  const { session, loading: authLoading, companySettings } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('inventario');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [expenses, setExpenses] = useState<OperationalExpense[]>([]);
  const [compatibilities, setCompatibilities] = useState<VehicleCompatibility[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(*)')
      .order('name');
    if (error) { showToast(`Error cargando productos: ${error.message}`, 'error'); return; }
    if (data) setProducts(data as Product[]);
  }, []);

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase.from('categories').select('*').order('sort_order');
    if (error) { showToast(`Error cargando categorías: ${error.message}`, 'error'); return; }
    if (data) setCategories(data as Category[]);
  }, []);

  const fetchInvoices = useCallback(async () => {
    const { data, error } = await supabase.from('invoices').select('*').order('issue_date', { ascending: false });
    if (error) { showToast(`Error cargando facturas: ${error.message}`, 'error'); return; }
    if (data) setInvoices(data as Invoice[]);
  }, []);

  const fetchMovements = useCallback(async () => {
    const allMovements: Movement[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('movements')
        .select('*, products(sku, name, image_url, price_total)')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        showToast(`Error cargando movimientos: ${error.message}`, 'error');
        return;
      }

      if (data && data.length > 0) {
        allMovements.push(...(data as Movement[]));
        offset += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    setMovements(allMovements);
  }, []);

  const fetchExpenses = useCallback(async () => {
    const { data, error } = await supabase.from('operational_expenses').select('*').order('expense_date', { ascending: false });
    if (error) { showToast(`Error cargando gastos: ${error.message}`, 'error'); return; }
    if (data) setExpenses(data as OperationalExpense[]);
  }, []);

  const fetchCompatibilities = useCallback(async () => {
    const { data, error } = await supabase
      .from('vehicle_compatibilities')
      .select('*, products(sku, name)')
      .order('created_at', { ascending: false });
    if (error) { showToast(`Error cargando compatibilidades: ${error.message}`, 'error'); return; }
    if (data) setCompatibilities(data as VehicleCompatibility[]);
  }, []);

  const fetchSuppliers = useCallback(async () => {
    const { data, error } = await supabase.from('suppliers').select('*').order('created_at', { ascending: false });
    if (error) { showToast(`Error cargando proveedores: ${error.message}`, 'error'); return; }
    if (data) setSuppliers(data as Supplier[]);
  }, []);

  const fetchPurchaseOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(name)')
      .order('created_at', { ascending: false });
    if (error) { showToast(`Error cargando órdenes: ${error.message}`, 'error'); return; }
    if (data) setPurchaseOrders(data as PurchaseOrder[]);
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([
      fetchProducts(), fetchCategories(), fetchInvoices(), fetchMovements(),
      fetchExpenses(), fetchCompatibilities(), fetchSuppliers(), fetchPurchaseOrders(),
    ]);
    setLoading(false);
  }, [fetchProducts, fetchCategories, fetchInvoices, fetchMovements, fetchExpenses, fetchCompatibilities, fetchSuppliers, fetchPurchaseOrders]);

  useEffect(() => {
    if (session) fetchAll();
    else setLoading(false);
  }, [session, fetchAll]);

  // Realtime subscriptions
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel('erp-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchProducts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => fetchCategories())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => fetchInvoices())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movements' }, () => fetchMovements())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operational_expenses' }, () => fetchExpenses())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_compatibilities' }, () => fetchCompatibilities())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, () => fetchSuppliers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => fetchPurchaseOrders())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session, fetchProducts, fetchCategories, fetchInvoices, fetchMovements, fetchExpenses, fetchCompatibilities, fetchSuppliers, fetchPurchaseOrders]);

  const handleSellScanned = useCallback(async (items: PurchaseOrderItem[]) => {
    const totalCost = items.reduce((sum, i) => sum + i.unit_cost * i.quantity, 0);
    const { error } = await supabase.from('purchase_orders').insert({
      status: 'pendiente',
      items: items as unknown as Record<string, unknown>,
      total_cost: totalCost,
    });
    if (error) {
      showToast(`Error al crear orden: ${error.message}`, 'error');
    } else {
      showToast('Orden de compra creada desde escaneo', 'success');
      setActiveTab('ordenes');
      fetchPurchaseOrders();
    }
  }, [fetchPurchaseOrders]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-slate-700 border-t-red-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <>
        <LoginScreen />
        <ToastContainer />
      </>
    );
  }

  const activeModules = companySettings?.active_modules || {};
  const allTabs: Array<{ key: TabKey; label: string; icon: typeof Boxes }> = [
    { key: 'inventario', label: 'Inventario', icon: Boxes },
    { key: 'facturacion', label: 'Facturación', icon: FileText },
    { key: 'historial', label: 'Movimientos', icon: History },
    { key: 'costos', label: 'Costos e Insumos', icon: Receipt },
    { key: 'metricas', label: 'Métricas & Reportes', icon: BarChart3 },
    { key: 'vehiculos', label: 'Vehículos', icon: Car },
    { key: 'proveedores', label: 'Proveedores', icon: Building2 },
    { key: 'ordenes', label: 'Órdenes de Compra', icon: ClipboardList },
    { key: 'ajustes', label: 'Ajustes', icon: Settings },
  ];
  const tabs = allTabs.filter((t) => activeModules[t.key] !== false);

  return (
    <div className="min-h-screen bg-slate-100">
      <Header />
      <ToastContainer />

      <nav className="bg-white border-b border-slate-200 sticky top-[57px] z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                    isActive ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-3 border-slate-200 border-t-red-600 rounded-full animate-spin" />
            <p className="text-sm text-slate-400 mt-3">Cargando...</p>
          </div>
        ) : (
          <div className="animate-fade-in">
            {activeTab === 'inventario' && (
              <InventoryTab
                products={products}
                categories={categories}
                onProductsChange={fetchAll}
                onCategoriesChange={fetchCategories}
                onSellScanned={handleSellScanned}
              />
            )}
            {activeTab === 'facturacion' && (
              <InvoiceModule invoices={invoices} onRefresh={fetchInvoices} />
            )}
            {activeTab === 'historial' && <MovementHistory movements={movements} />}
            {activeTab === 'costos' && (
              <OperationalExpenses expenses={expenses} onRefresh={fetchExpenses} />
            )}
            {activeTab === 'metricas' && (
              <MetricsDashboard movements={movements} expenses={expenses} />
            )}
            {activeTab === 'vehiculos' && (
              <VehicleModule
                compatibilities={compatibilities}
                products={products}
                onRefresh={fetchCompatibilities}
              />
            )}
            {activeTab === 'proveedores' && (
              <Suppliers suppliers={suppliers} onRefresh={fetchSuppliers} />
            )}
            {activeTab === 'ordenes' && (
              <PurchaseOrders
                orders={purchaseOrders}
                suppliers={suppliers}
                onRefresh={fetchPurchaseOrders}
              />
            )}
            {activeTab === 'ajustes' && <SettingsModule />}
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center">
        <p className="text-xs text-slate-400">
          BRAKE FILTER — Control de Bodega &amp; ERP · Sincronización en tiempo real activa
        </p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

export default App;
