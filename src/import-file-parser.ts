import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Readable } from 'stream';
import csv from 'csv-parser';

const s3 = new S3Client({});
const sqs = new SQSClient({});
const BUCKET_NAME = process.env.BUCKET_NAME!;
const QUEUE_URL = process.env.QUEUE_URL!;

export const handler = async (event: S3Event) => {
  for (const rec of event.Records) {
    const key = decodeURIComponent(rec.s3.object.key);
    console.info('Processing key:', key);

    const { Body } = await s3.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));

    const rows: any[] = [];
    await new Promise<void>((resolve, reject) => {
      (Body as Readable)
        .pipe(csv({ headers: ['title','description','price','count'], skipLines: 1 }))
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    for (const r of rows) {
      await sqs.send(new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify({
          title: String(r.title).trim(),
          description: String(r.description ?? '').trim(),
          price: Number(r.price),
          count: Number(r.count),
        }),
      }));
    }

    const parsedKey = key.replace(/^uploaded\//, 'parsed/');
    await s3.send(new CopyObjectCommand({ Bucket: BUCKET_NAME, CopySource: `${BUCKET_NAME}/${key}`, Key: parsedKey }));
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    console.info(`Moved ${key} → ${parsedKey}`);
  }
};