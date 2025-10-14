import { S3Event, S3Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import csv from 'csv-parser';

const bucket = process.env.BUCKET_NAME!;
const queueUrl = process.env.QUEUE_URL!;
const uploadedPrefix = process.env.UPLOADED_PREFIX || 'uploaded/';
const parsedPrefix = process.env.PARSED_PREFIX || 'parsed/';

const s3 = new S3Client({});
const sqs = new SQSClient({});

export const handler: S3Handler = async (event: S3Event) => {
  for (const record of event.Records) {
    const key = decodeURIComponent(record.s3.object.key);
    console.log('New object:', key);

    if (!key.startsWith(uploadedPrefix)) {
      console.log('Skip object (not in uploaded/):', key);
      continue;
    }

    try {
      const getRes = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const bodyStream = getRes.Body as NodeJS.ReadableStream;

      const rows: any[] = [];
      await new Promise<void>((resolve, reject) => {
        bodyStream
          .pipe(csv())
          .on('data', (row) => {
            console.log('CSV row:', row);
            rows.push(row);
          })
          .on('end', () => {
            console.log('CSV parsing finished for', key);
            resolve();
          })
          .on('error', (err) => {
            console.error('CSV parsing error:', err);
            reject(err);
          });
      });

      // Send each row to SQS
      for (const row of rows) {
        await sqs.send(new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(row),
        }));
        console.log('Sent to SQS:', row.title);
      }

      const destKey = key.replace(uploadedPrefix, parsedPrefix);

      await s3.send(new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${key}`,
        Key: destKey,
      }));

      await s3.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }));

      console.log(`Moved ${key} -> ${destKey}`);
    } catch (err) {
      console.error('importFileParser error:', err);
    }
  }
};