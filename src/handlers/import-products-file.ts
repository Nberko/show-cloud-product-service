import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const bucket = process.env.BUCKET_NAME!;
const uploadedPrefix = process.env.UPLOADED_PREFIX || 'uploaded/';
const expires = parseInt(process.env.URL_EXPIRES_SECONDS || '300', 10);

const s3 = new S3Client({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const fileName = event.queryStringParameters?.name;
    if (!fileName) {
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({ error: 'Query parameter "name" is required' }),
      };
    }

    const key = `${uploadedPrefix}${fileName}`;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: 'text/csv',
    });
    const url = await getSignedUrl(s3, command, { expiresIn: expires });

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({ url, bucket, key, expires }),
    };
  } catch (err) {
    console.error('importProductsFile error:', err);
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}