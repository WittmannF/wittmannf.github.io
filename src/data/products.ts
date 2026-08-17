import { AMAZON_ASSOCIATE_TAG } from '../config/site';

export interface Product {
  id: string;
  name: string;
  asin?: string;
  amazonDomain?: string;
  affiliateUrl?: string;
  description?: string;
}

export const products = {
  grinder1zpresso: {
    id: 'grinder-1zpresso',
    name: '1Zpresso manual coffee grinder',
    asin: 'B0GMT2NT39',
    amazonDomain: 'www.amazon.com',
    affiliateUrl: 'https://amzn.to/4cFbiVp',
  },
  aeropressTravelPress: {
    id: 'aeropress-travel-press',
    name: 'AeroPress travel coffee press',
    asin: 'B07YVL8SF3',
    amazonDomain: 'www.amazon.com',
    affiliateUrl: 'https://amzn.to/4gbJZTK',
  },
  aeropressFilters: {
    id: 'aeropress-filters',
    name: 'AeroPress paper micro-filters',
    asin: 'B000LTOCSG',
    amazonDomain: 'www.amazon.com',
    affiliateUrl: 'https://amzn.to/4xJ8iiS',
  },
  compactImmersionHeater: {
    id: 'compact-immersion-heater',
    name: 'compact immersion water heater',
    affiliateUrl: 'https://amzn.to/4cqmjKe',
    description: 'International option similar to the ultracompact mate heaters common in southern Brazil.',
  },
} satisfies Record<string, Product>;

export type ProductKey = keyof typeof products;

export function amazonUrl(product: Product, associateTag = AMAZON_ASSOCIATE_TAG) {
  if (product.affiliateUrl) return product.affiliateUrl;

  if (!product.asin) {
    throw new Error(`Product ${product.id} needs either an affiliateUrl or an asin.`);
  }

  const base = `https://${product.amazonDomain ?? 'www.amazon.com'}/dp/${product.asin}`;

  if (!associateTag) return base;

  return `${base}?tag=${encodeURIComponent(associateTag)}`;
}
