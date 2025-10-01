import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { internalError, ok } from '../utils/response';

const region = process.env.AWS_REGION!;
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE!;
const STOCK_TABLE = process.env.STOCK_TABLE!;

const ddb = new DynamoDBClient({ region });
const doc = DynamoDBDocumentClient.from(ddb);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const productId = event.pathParameters?.productId;
  console.log('GET /products/{productId}', productId);

  if (!productId) return internalError(400, 'productId is required');

  try {
    const [prod, stock] = await Promise.all([
      doc.send(new GetCommand({ TableName: PRODUCTS_TABLE, Key: { id: productId } })),
      doc.send(new GetCommand({ TableName: STOCK_TABLE, Key: { product_id: productId } })),
    ]);

    if (!prod.Item) return internalError(404, 'Product not found');

    const result = {
      id: prod.Item.id,
      title: prod.Item.title,
      description: prod.Item.description ?? '',
      price: prod.Item.price,
      count: stock.Item?.count ?? 0,
    };

    return ok(result);
  } catch (e) {
    console.error(e);
    return internalError(500, 'Internal Server Error');
  }
};