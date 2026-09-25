import { supabase } from '@/lib/supabase';

interface ShippingRate {
  weight_min_g: number;
  weight_max_g: number;
  price_tier_1: number;
  price_tier_2: number;
  price_tier_3: number;
}

let cachedRates: ShippingRate[] | null = null;

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

  // Over max bracket: return last bracket's price
  const last = rates[rates.length - 1];
  return [last.price_tier_1, last.price_tier_2, last.price_tier_3][tierIndex];
}

const COMMISSION_RATE = 0.19;

export function getShippingCost(weightG: number, salePrice: number): number {
  // Synchronous fallback using cached rates if available, otherwise 0
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
}

export function getCommission(salePrice: number): number {
  return Math.round(salePrice * COMMISSION_RATE);
}

export interface MargenCalculation {
  commission: number;
  shippingCost: number;
  netMargin: number;
}

export function calculateMargenML(
  salePrice: number,
  purchasePrice: number,
  weightG: number,
  customShippingCost?: number,
): MargenCalculation {
  const commission = getCommission(salePrice);
  const shippingCost = customShippingCost ?? getShippingCost(weightG, salePrice);
  const netMargin = salePrice - commission - shippingCost - purchasePrice;
  return { commission, shippingCost, netMargin };
}

export function calculateMargenDirect(
  salePrice: number,
  purchasePrice: number,
  shippingCost = 0,
): MargenCalculation {
  return {
    commission: 0,
    shippingCost,
    netMargin: salePrice - shippingCost - purchasePrice,
  };
}
