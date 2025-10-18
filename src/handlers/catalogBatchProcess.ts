import { SQSEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { TransactWriteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { randomUUID } from 'crypto';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sns = new SNSClient({});
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE!;
const STOCK_TABLE = process.env.STOCK_TABLE!;
const TOPIC_ARN = process.env.TOPIC_ARN!;

export const handler = async (event: SQSEvent) => {
  const created: any[] = [];

  for (const record of event.Records) {
    const payload = JSON.parse(record.body);
    const id = payload.id ?? randomUUID();

    await ddb.send(new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: PRODUCTS_TABLE, Item: { id, title: payload.title, description: payload.description ?? '', price: Number(payload.price) } } },
        { Put: { TableName: STOCK_TABLE,    Item: { product_id: id, count: Number(payload.count ?? 0) } } },
      ],
    }));

    created.push({ id, ...payload });
  }

  if (created.length) {
    await sns.send(new PublishCommand({
      TopicArn: TOPIC_ARN,
      Subject: `Created ${created.length} product(s)`,
      Message: JSON.stringify(created),
    }));
  }

  return { statusCode: 200, body: JSON.stringify({ created: created.length }) };
};