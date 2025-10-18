import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export class ShowCloudProductServiceStack extends cdk.Stack {
  public readonly catalogQueue: sqs.Queue;
  public readonly createProductTopic: sns.Topic;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const PRODUCTS_TABLE = 'products';
    const STOCK_TABLE = 'stock';

    this.catalogQueue = new sqs.Queue(this, 'catalogItemsQueue', {
      visibilityTimeout: cdk.Duration.seconds(60),
    });

    this.createProductTopic = new sns.Topic(this, 'createProductTopic', {
      displayName: 'Product created notifications',
    });
    this.createProductTopic.addSubscription(new subs.EmailSubscription('your.email@example.com'));

    const commonEnv = { PRODUCTS_TABLE, STOCK_TABLE };
    const bundlingOptions = { externalModules: ['@aws-sdk/*'] };

    const getProductsList = new NodejsFunction(this, 'GetProductsListFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../src/handlers/getProductsList.ts'),
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: commonEnv,
      bundling: bundlingOptions,
    });
    const getProductsById = new NodejsFunction(this, 'GetProductsByIdFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../src/handlers/getProductsById.ts'),
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: commonEnv,
      bundling: bundlingOptions,
    });
    const createProduct = new NodejsFunction(this, 'CreateProductFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../src/handlers/createProduct.ts'),
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: commonEnv,
      bundling: bundlingOptions,
    });

    const catalogBatchProcess = new NodejsFunction(this, 'CatalogBatchProcessFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../src/handlers/catalogBatchProcess.ts'),
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        PRODUCTS_TABLE,
        STOCK_TABLE,
        TOPIC_ARN: this.createProductTopic.topicArn,
      },
      bundling: bundlingOptions,
    });

    catalogBatchProcess.addEventSource(new SqsEventSource(this.catalogQueue, {
      batchSize: 5,
    }));

    const region = cdk.Stack.of(this).region;
    const account = cdk.Stack.of(this).account;
    const ddbArn = (t: string) => `arn:aws:dynamodb:${region}:${account}:table/${t}`;

    const ddbRead = new iam.PolicyStatement({
      actions: ['dynamodb:GetItem','dynamodb:BatchGetItem','dynamodb:Scan','dynamodb:Query'],
      resources: [ddbArn(PRODUCTS_TABLE), ddbArn(STOCK_TABLE)],
    });
    const ddbWrite = new iam.PolicyStatement({
      actions: ['dynamodb:PutItem','dynamodb:TransactWriteItems'],
      resources: [ddbArn(PRODUCTS_TABLE), ddbArn(STOCK_TABLE)],
    });

    [getProductsList, getProductsById, createProduct, catalogBatchProcess]
      .forEach(fn => fn.addToRolePolicy(ddbRead));
    [createProduct, catalogBatchProcess].forEach(fn => fn.addToRolePolicy(ddbWrite));

    this.createProductTopic.grantPublish(catalogBatchProcess);

    const api = new apigw.RestApi(this, 'ProductsApi', {
      restApiName: 'Products Service',
      description: 'Serverless API for products',
      defaultCorsPreflightOptions: { allowOrigins: apigw.Cors.ALL_ORIGINS, allowMethods: ['GET','POST','OPTIONS'] },
      deployOptions: { stageName: 'prod' },
    });
    const productsResource = api.root.addResource('products');
    productsResource.addMethod('GET', new apigw.LambdaIntegration(getProductsList));
    productsResource.addMethod('POST', new apigw.LambdaIntegration(createProduct));
    productsResource.addResource('{productId}')
      .addMethod('GET', new apigw.LambdaIntegration(getProductsById));

    new cdk.CfnOutput(this, 'CatalogQueueUrl', { value: this.catalogQueue.queueUrl });
    new cdk.CfnOutput(this, 'CreateProductTopicArn', { value: this.createProductTopic.topicArn });
  }
}