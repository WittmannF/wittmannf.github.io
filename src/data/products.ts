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
    name: '1Zpresso Q Manual Coffee Grinder',
    asin: 'B0GMT2NT39',
    amazonDomain: 'www.amazon.com',
    affiliateUrl: 'https://amzn.to/4cFbiVp',
  },
  aeropressTravelPress: {
    id: 'aeropress-travel-press',
    name: 'AeroPress Go Portable Coffee Maker Kit',
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
    name: 'Immersion Water Heater',
    affiliateUrl: 'https://amzn.to/4cqmjKe',
    description: 'International option similar to the ultracompact mate heaters common in southern Brazil.',
  },
  grinder1zpressoHome: {
    id: 'grinder-1zpresso-home',
    name: '1Zpresso manual coffee grinder for home use',
    affiliateUrl: 'https://amzn.to/4g3J7Sp',
  },
  kintoTravelTumbler: {
    id: 'kinto-travel-tumbler',
    name: 'KINTO 20942 Travel Tumbler',
    affiliateUrl: 'https://amzn.to/4wEWNsb',
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
