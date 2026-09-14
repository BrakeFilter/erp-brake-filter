import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, Category, Invoice, Movement, OperationalExpense, TabKey } from '@/types';
import { Header } from '@/components/Header';
import { ToastContainer } from '@/components/ToastContainer';
import { InventoryTab } from '@/components/InventoryTab';
import { InvoiceModule } from '@/components/InvoiceModule';
import { MovementHistory } from '@/components/MovementHistory';
import { OperationalExpenses } from '@/components/OperationalExpenses';
import { MetricsDashboard } from '@/components/MetricsDashboard';
import { Boxes, FileText, History, Receipt, BarChart3 } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('inventario');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [expenses, setExpenses] = useState<OperationalExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase
      .from('products')
      .select('*, categories(*)')
      .order('name');
    if (data) setProducts(data as Product[]);
  }, []);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('sort_order');
    if (data) setCategories(data as Category[]);
  }, []);

  const fetchInvoices = useCallback(async () => {
    const { data } = await supabase.from('invoices').select('*').order('issue_date', { ascending: false });
    if (data) setInvoices(data as Invoice[]);
  }, []);

  const fetchMovements = useCallback(async () => {
    const { data } = await supabase
      .from('movements')
      .select('*, products(sku, name, image_url, price_total)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (data) setMovements(data as Movement[]);
  }, []);

  const fetchExpenses = useCallback(async () => {
    const { data } = await supabase.from('operational_expenses').select('*').order('expense_date', { ascending: false });
    if (data) setExpenses(data as OperationalExpense[]);
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchProducts(), fetchCategories(), fetchInvoices(), fetchMovements(), fetchExpenses()]);
    setLoading(false);
  }, [fetchProducts, fetchCategories, fetchInvoices, fetchMovements, fetchExpenses]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('erp-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchProducts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => fetchCategories())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => fetchInvoices())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movements' }, () => fetchMovements())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operational_expenses' }, () => fetchExpenses())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProducts, fetchCategories, fetchInvoices, fetchMovements, fetchExpenses]);

  const tabs: Array<{ key: TabKey; label: string; icon: typeof Boxes }> = [
    { key: 'inventario', label: 'Inventario', icon: Boxes },
    { key: 'facturacion', label: 'Facturación', icon: FileText },
    { key: 'historial', label: 'Movimientos', icon: History },
    { key: 'costos', label: 'Costos e Insumos', icon: Receipt },
    { key: 'metricas', label: 'Métricas & Reportes', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <Header />
      <ToastContainer />

      {/* Tab Navigation */}
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
                    isActive
                      ? 'border-red-600 text-red-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-3 border-slate-200 border-t-red-600 rounded-full animate-spin" />
            <p className="text-sm text-slate-400 mt-3">Cargando inventario...</p>
          </div>
        ) : (
          <div className="animate-fade-in">
            {activeTab === 'inventario' && (
              <InventoryTab
                products={products}
                categories={categories}
                onProductsChange={fetchAll}
                onCategoriesChange={fetchCategories}
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
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center">
        <p className="text-xs text-slate-400">
          BRAKE FILTER — Control de Bodega & ERP · Demo Beta · Sincronización en tiempo real activa
        </p>
      </footer>
    </div>
  );
}

export default App;
