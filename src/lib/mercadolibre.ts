// Mercado Libre shipping cost matrix based on weight (kg) and sale price (CLP)
// Three price tiers: up to $9,989 / $9,990–$19,989 / $19,990+
// Weight brackets from 0.3kg up to 60kg+

interface WeightBracket {
  maxKg: number;
  costs: [number, number, number]; // [tier1, tier2, tier3]
}

const shippingMatrix: WeightBracket[] = [
  { maxKg: 0.3, costs: [800, 1000, 3050] },
  { maxKg: 0.5, costs: [810, 1020, 3150] },
  { maxKg: 1, costs: [830, 1040, 3250] },
  { maxKg: 1.5, costs: [850, 1060, 3400] },
  { maxKg: 2, costs: [870, 1080, 3600] },
  { maxKg: 3, costs: [900, 1100, 3950] },
  { maxKg: 4, costs: [1040, 1280, 4550] },
  { maxKg: 5, costs: [1180, 1460, 4900] },
  { maxKg: 6, costs: [1330, 1640, 5200] },
  { maxKg: 8, costs: [1470, 1820, 5800] },
  { maxKg: 10, costs: [1590, 1990, 6200] },
  { maxKg: 15, costs: [1740, 2290, 7200] },
  { maxKg: 20, costs: [1890, 2590, 8500] },
  { maxKg: 25, costs: [2040, 2890, 10000] },
  { maxKg: 30, costs: [2190, 3190, 13050] },
  { maxKg: 40, costs: [2390, 3590, 15000] },
  { maxKg: 50, costs: [2590, 3990, 17300] },
  { maxKg: 60, costs: [2790, 4390, 19000] },
];

const COMMISSION_RATE = 0.19;

export function getShippingCost(weightKg: number, salePrice: number): number {
  let tierIndex: 0 | 1 | 2;
  if (salePrice < 9990) {
    tierIndex = 0;
  } else if (salePrice <= 19989) {
    tierIndex = 1;
  } else {
    tierIndex = 2;
  }

  const weight = Math.max(weightKg, 0);

  for (const bracket of shippingMatrix) {
    if (weight <= bracket.maxKg) {
      return bracket.costs[tierIndex];
    }
  }

  // Over 60kg: extrapolate from last bracket with incremental steps
  const last = shippingMatrix[shippingMatrix.length - 1];
  const extraSteps = Math.ceil((weight - last.maxKg) / 10);
  return last.costs[tierIndex] + extraSteps * 200;
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
  weightKg: number,
  customShippingCost?: number,
): MargenCalculation {
  const commission = getCommission(salePrice);
  const shippingCost = customShippingCost ?? getShippingCost(weightKg, salePrice);
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
