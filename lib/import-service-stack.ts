// lib/import-service-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'ImportBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const importProductsFile = new lambda.Function(this, 'ImportProductsFileFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      handler: 'import-products-file.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../src/handlers')),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        UPLOADED_PREFIX: 'uploaded/',
        URL_EXPIRES_SECONDS: '300',
      },
    });

    bucket.grantPut(importProductsFile, 'uploaded/*');

    const api = new apigw.RestApi(this, 'ImportApi', {
      restApiName: 'Import Service',
      description: 'Issue presigned URLs for S3 upload and parse CSV via S3 events',
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'OPTIONS'],
      },
      deployOptions: { stageName: 'prod' },
    });

    const importResource = api.root.addResource('import');
    importResource.addMethod('GET', new apigw.LambdaIntegration(importProductsFile));

    const importFileParser = new NodejsFunction(this, "ImportFileParserFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "../src/import-file-parser.ts"),
      handler: "handler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
      bundling: {
        externalModules: ["aws-sdk"],
      },
    });

    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(importFileParser),
      { prefix: "uploaded/" }
    );

    bucket.grantReadWrite(importFileParser);

    importFileParser.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:CopyObject', 's3:DeleteObject'],
      resources: [bucket.arnForObjects('*')],
    }));

    new cdk.CfnOutput(this, 'ImportApiUrl', { value: api.url ?? 'n/a', description: 'API base URL' });
    new cdk.CfnOutput(this, 'GetImportUrl', { value: `${api.url}import?name=<your-file.csv>` });
    new cdk.CfnOutput(this, 'ImportBucketName', { value: bucket.bucketName });
  }
}