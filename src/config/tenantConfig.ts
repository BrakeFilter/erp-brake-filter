export interface TenantConfig {
  companyName: string;
  subtitle: string;
  logoIcon: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  cardBackground: string;
  currency: string;
  currencySymbol: string;
  taxRate: number;
  taxLabel: string;
  locale: string;
  defaultCategories: string[];
}

export const tenantConfig: TenantConfig = {
  companyName: 'BRAKE FILTER',
  subtitle: 'CONTROL DE BODEGA & ERP',
  logoIcon: 'disc',
  primaryColor: '#DC2626',
  secondaryColor: '#1E293B',
  accentColor: '#0F172A',
  backgroundColor: '#F8FAFC',
  cardBackground: '#FFFFFF',
  currency: 'CLP',
  currencySymbol: '$',
  taxRate: 19,
  taxLabel: 'IVA (19%)',
  locale: 'es-CL',
  defaultCategories: [
    'Filtros de Aire',
    'Filtros de Aceite',
    'Filtros de Combustible',
    'Pastillas de Freno',
    'Discos de Freno',
    'Líquidos & Aditivos',
  ],
};
