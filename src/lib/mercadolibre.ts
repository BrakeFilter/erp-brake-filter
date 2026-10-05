import { supabase } from '@/lib/supabase';

interface ShippingRate {
  weight_min_g: number;
  weight_max_g: number;
  price_tier_1: number;
  price_tier_2: number;
  price_tier_3: number;
}

let cachedRates: ShippingRate[] | null = null;
let cachedMlCommissionPercent: number | null = null;

async function fetchShippingRates(): Promise<ShippingRate[]> {
  if (cachedRates) return cachedRates;
  const { data, error } = await supabase
    .from('shipping_rates')
    .select('weight_min_g, weight_max_g, price_tier_1, price_tier_2, price_tier_3')
    .order('weight_min_g');
  if (error || !data || data.length === 0) return [];
  cachedRates = data as ShippingRate[];
  return cachedRates;
}

export async function getShippingCostAsync(weightG: number, salePrice: number): Promise<number> {
  const rates = await fetchShippingRates();
  if (rates.length === 0) return 0;

  let tierIndex: 0 | 1 | 2;
  if (salePrice < 89990) {
    tierIndex = 0;
  } else if (salePrice < 119990) {
    tierIndex = 1;
  } else {
    tierIndex = 2;
  }

  const weight = Math.max(weightG, 0);

  for (const rate of rates) {
    if (weight >= rate.weight_min_g && weight <= rate.weight_max_g) {
      return [rate.price_tier_1, rate.price_tier_2, rate.price_tier_3][tierIndex];
    }
  }

  const last = rates[rates.length - 1];
  return [last.price_tier_1, last.price_tier_2, last.price_tier_3][tierIndex];
}

export async function getMlCommissionPercent(): Promise<number> {
  if (cachedMlCommissionPercent !== null) return cachedMlCommissionPercent;
  const { data } = await supabase
    .from('company_settings')
    .select('ml_commission_percent')
    .maybeSingle();
  cachedMlCommissionPercent = data?.ml_commission_percent ?? 13.5;
  return cachedMlCommissionPercent;
}

export function setMlCommissionPercent(percent: number) {
  cachedMlCommissionPercent = percent;
}

export function getShippingCost(weightG: number, salePrice: number): number {
  if (!cachedRates || cachedRates.length === 0) return 0;

  let tierIndex: 0 | 1 | 2;
  if (salePrice < 89990) {
    tierIndex = 0;
  } else if (salePrice < 119990) {
    tierIndex = 1;
  } else {
    tierIndex = 2;
  }

  const weight = Math.max(weightG, 0);

  for (const rate of cachedRates) {
    if (weight >= rate.weight_min_g && weight <= rate.weight_max_g) {
      return [rate.price_tier_1, rate.price_tier_2, rate.price_tier_3][tierIndex];
    }
  }

  const last = cachedRates[cachedRates.length - 1];
  return [last.price_tier_1, last.price_tier_2, last.price_tier_3][tierIndex];
}

export async function preloadShippingRates(): Promise<void> {
  await fetchShippingRates();
  await getMlCommissionPercent();
}

// Real Chilean ML calculation with IVA 19%
export interface SaleCalculation {
  precio_publicacion: number;
  iva_venta: number;
  comision_ml: number;
  iva_comision: number;
  envio_ml: number;
  costo_producto: number;
  costo_total_venta: number;
  margen_neto: number;
  margen_porcentaje: number;
}

const IVA_RATE = 0.19;

export function calculateMLSale(
  precioPublicacion: number,
  costoProducto: number,
  pesoGramos: number,
  comisionPercent: number,
  customShipping?: number,
): SaleCalculation {
  const iva_venta = Math.round(precioPublicacion * IVA_RATE);
  const comision_ml = Math.round(precioPublicacion * (comisionPercent / 100));
  const iva_comision = Math.round(comision_ml * IVA_RATE);
  const envio_ml = customShipping ?? getShippingCost(pesoGramos, precioPublicacion);
  const costo_total_venta = costoProducto + comision_ml + iva_comision + iva_venta + envio_ml;
  const margen_neto = precioPublicacion - costo_total_venta;
  const margen_porcentaje = precioPublicacion > 0 ? (margen_neto / precioPublicacion) * 100 : 0;

  return {
    precio_publicacion: precioPublicacion,
    iva_venta,
    comision_ml,
    iva_comision,
    envio_ml,
    costo_producto: costoProducto,
    costo_total_venta,
    margen_neto,
    margen_porcentaje,
  };
}

export function calculateDirectSale(
  precioVenta: number,
  costoProducto: number,
  customShipping = 0,
): SaleCalculation {
  const iva_venta = Math.round(precioVenta * IVA_RATE);
  const envio_ml = customShipping;
  const costo_total_venta = costoProducto + iva_venta + envio_ml;
  const margen_neto = precioVenta - costo_total_venta;
  const margen_porcentaje = precioVenta > 0 ? (margen_neto / precioVenta) * 100 : 0;

  return {
    precio_publicacion: precioVenta,
    iva_venta,
    comision_ml: 0,
    iva_comision: 0,
    envio_ml,
    costo_producto: costoProducto,
    costo_total_venta,
    margen_neto,
    margen_porcentaje,
  };
}
