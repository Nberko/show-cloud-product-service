import { products } from '../data/products';

export const handler = async (event: any) => {
  const id = event?.pathParameters?.productId;
  const product = products.find(p => p.id === id);

  if (!product) {
    return {
      statusCode: 404,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS' },
      body: JSON.stringify({ message: 'Product not found' }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS' },
    body: JSON.stringify(product),
  };
};