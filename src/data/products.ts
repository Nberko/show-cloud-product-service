export type Product = { id: string; title: string; price: number; description?: string };

export const products: Product[] = [
  { id: 'p-1', title: 'Apple Watch', price: 299, description: 'Series X' },
  { id: 'p-2', title: 'AirPods',     price: 129, description: '2nd gen' },
  { id: 'p-3', title: 'Kindle',      price: 99,  description: 'Paperwhite' },
];