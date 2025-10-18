import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { cors, internalError } from '../utils/response';

const region = process.env.AWS_REGION!;
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE!;
const STOCK_TABLE = process.env.STOCK_TABLE!;

const ddb = new DynamoDBClient({ region });
const doc = DynamoDBDocumentClient.from(ddb);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log('POST /products', event.body);

  try {
    if (!event.body) return internalError(400, 'Body is required');
    const body = JSON.parse(event.body);

    const { title, description = '', price, count = 0 } = body || {};
    if (!title || typeof price !== 'number') {
      return internalError(400, 'Invalid payload: { title: string, price: number, description?: string, count?: number }');
    }

    const id = randomUUID();

    await doc.send(new PutCommand({
      TableName: PRODUCTS_TABLE,
      Item: { id, title, description, price }
    }));

    await doc.send(new PutCommand({
      TableName: STOCK_TABLE,
      Item: { product_id: id, count: Number(count) || 0 }
    }));

    const result = { id, title, description, price, count: Number(count) || 0 };

    return {
      statusCode: 201,
      headers: cors(),
      body: JSON.stringify(result),
    };
    
  } catch (e) {
    console.error(e);
    return internalError(500, 'Internal Server Error');
  }
};