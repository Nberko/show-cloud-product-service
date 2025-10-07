import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';

export class ShowCloudProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const productsTable = dynamodb.Table.fromTableAttributes(this, 'ProductsTable', {
      tableArn: cdk.Stack.of(this).formatArn({
        service: 'dynamodb',
        resource: 'table',
        resourceName: 'products',
      }),
    });

    const stockTable = dynamodb.Table.fromTableAttributes(this, 'StockTable', {
      tableArn: cdk.Stack.of(this).formatArn({
        service: 'dynamodb',
        resource: 'table',
        resourceName: 'stock',
      }),
    });

    const lambdaCode = lambda.Code.fromAsset(path.join(__dirname, '../src'));

    const env = {
      PRODUCTS_TABLE: productsTable.tableName,
      STOCK_TABLE: stockTable.tableName,
    };

    const getProductsList = new lambda.Function(this, 'GetProductsListFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/getProductsList.handler',
      code: lambdaCode,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: env,
    });

    const getProductsById = new lambda.Function(this, 'GetProductsByIdFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/getProductsById.handler',
      code: lambdaCode,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: env,
    });

    const createProduct = new lambda.Function(this, 'CreateProductFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/createProduct.handler',
      code: lambdaCode,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: env,
    });

    productsTable.grantReadData(getProductsList);
    stockTable.grantReadData(getProductsList);

    productsTable.grantReadData(getProductsById);
    stockTable.grantReadData(getProductsById);

    productsTable.grantWriteData(createProduct);
    stockTable.grantWriteData(createProduct);

    const api = new apigw.RestApi(this, 'ProductsApi', {
      restApiName: 'Products Service',
      description: 'Serverless API for products',
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
      },
      deployOptions: { stageName: 'prod' },
    });

    const productsResource = api.root.addResource('products');
    productsResource.addMethod('GET', new apigw.LambdaIntegration(getProductsList, {
      proxy: false,
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type'"
          }
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type'"
          }
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type'"
          }
        }
      ]
    }), {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true
          }
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true
          }
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true
          }
        }
      ]
    });
    productsResource.addMethod('POST', new apigw.LambdaIntegration(createProduct));

    const productById = productsResource.addResource('{productId}');
    productById.addMethod('GET', new apigw.LambdaIntegration(getProductsById));

    new cdk.CfnOutput(this, 'ProductsApiUrl', { value: api.url ?? 'n/a' });
    new cdk.CfnOutput(this, 'GetProductsListUrl', { value: `${api.url}products` });
    new cdk.CfnOutput(this, 'GetProductsByIdUrl', { value: `${api.url}products/{productId}` });
  }
}