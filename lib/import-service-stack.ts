import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface ImportProps extends cdk.StackProps {
  catalogQueue: sqs.IQueue;
}

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ImportProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'ImportBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Get credentials from environment variables
    const credentials: { [key: string]: string } = {};

    // Parse all environment variables to find credential pairs
    Object.keys(process.env).forEach((key) => {
      const value = process.env[key];
      // Check if the value matches TEST_PASSWORD pattern and key doesn't start with common env prefixes
      if (value === 'TEST_PASSWORD' && !key.startsWith('AWS_') && !key.startsWith('CDK_')) {
        credentials[key] = value;
      }
    });

    // If no credentials found, use a default one (should be set in .env)
    if (Object.keys(credentials).length === 0) {
      console.warn('No credentials found in environment variables. Please set them in .env file.');
    }

    // Create the Basic Authorizer Lambda
    const basicAuthorizerFn = new NodejsFunction(this, 'BasicAuthorizerFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../src/handlers/basicAuthorizer.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      environment: credentials,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    });

    const importProductsFile = new NodejsFunction(this, 'ImportProductsFileFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../src/handlers/import-products-file.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      environment: { BUCKET_NAME: bucket.bucketName },
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    });
    bucket.grantPut(importProductsFile);

    // Create the authorizer
    const authorizer = new apigw.TokenAuthorizer(this, 'BasicAuthorizer', {
      handler: basicAuthorizerFn,
      identitySource: 'method.request.header.Authorization',
      resultsCacheTtl: cdk.Duration.seconds(0), // Disable caching for testing
    });

    const api = new apigw.RestApi(this, 'ImportApi', {
      restApiName: 'Import Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: ['GET','OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
      deployOptions: { stageName: 'prod' },
    });

    api.root.addResource('import').addMethod('GET', new apigw.LambdaIntegration(importProductsFile), {
      authorizer,
      authorizationType: apigw.AuthorizationType.CUSTOM,
    });

    const importFileParser = new NodejsFunction(this, 'ImportFileParserFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../src/handlers/import-file-parser.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      environment: {
        BUCKET_NAME: bucket.bucketName,
        QUEUE_URL: props.catalogQueue.queueUrl,
      },
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    });

    bucket.grantReadWrite(importFileParser);
    props.catalogQueue.grantSendMessages(importFileParser);

    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(importFileParser),
      { prefix: 'uploaded/' },
    );

    new cdk.CfnOutput(this, 'ImportBucketName', { value: bucket.bucketName });
    new cdk.CfnOutput(this, 'GetImportUrl', { value: `${api.url}import?name=<your-file.csv>` });
  }
}