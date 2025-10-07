import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import csv from "csv-parser";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.BUCKET_NAME!;

function parseCsv(stream: NodeJS.ReadableStream): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    stream
      .pipe(csv())
      .on("data", (data) => {
        console.log("CSV row:", data);
        rows.push(data);
      })
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

export const handler = async (event: any) => {
  console.log("S3 Event:", JSON.stringify(event));

  for (const record of event.Records ?? []) {
    const key: string = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    console.log("Processing key:", key);

    // 1) Считать файл из S3 и распарсить CSV
    const getRes = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    if (!getRes.Body) {
      console.warn("No Body in S3 object:", key);
      continue;
    }
    await parseCsv(getRes.Body as NodeJS.ReadableStream);

    const destKey = key.replace(/^uploaded\//, "parsed/");
    await s3.send(new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${key}`,
      Key: destKey,
    }));
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));

    console.log(`Moved ${key} → ${destKey}`);
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};