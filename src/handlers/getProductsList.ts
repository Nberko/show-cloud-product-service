import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { internalError, ok } from '../utils/response';

const region = process.env.AWS_REGION!;
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE!;
const STOCK_TABLE = process.env.STOCK_TABLE!;

const ddb = new DynamoDBClient({ region });
const doc = DynamoDBDocumentClient.from(ddb);

export const handler: APIGatewayProxyHandlerV2 = async () => {
  console.log('GET /products');

  try {
    const productsRes = await doc.send(new ScanCommand({ TableName: PRODUCTS_TABLE }));
    const products = (productsRes.Items || []) as Array<{ id: string; title: string; description?: string; price: number }>;

    if (products.length === 0) {
      console.warn('No products found in table', PRODUCTS_TABLE);
      return ok([]);
    }

    const keys = products.map(p => ({ product_id: p.id }));
    console.log('BatchGet keys for stock:', JSON.stringify(keys));

    const batch = await doc.send(new BatchGetCommand({
      RequestItems: {
        [STOCK_TABLE]: {
          Keys: keys
        }
      }
    }));

    const stocks = (batch.Responses?.[STOCK_TABLE] || []) as Array<{ product_id: string; count: number }>;
    const stockMap = new Map(stocks.map(s => [s.product_id, s.count]));

    const joined = products.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description ?? '',
      price: p.price,
      count: stockMap.get(p.id) ?? 0
    }));

    console.log('Joined products with stock:', JSON.stringify(joined));
    return ok(joined);
  } catch (e) {
    console.error('Error in getProductsList:', e);
    if (e instanceof Error) {
      return internalError(500, e.message + (e.stack ? '\n' + e.stack : ''));
    }
    return internalError(500, 'Internal Server Error');
  }
};