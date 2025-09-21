import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

export class ShowCloudProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const code = lambda.Code.fromAsset(path.join(__dirname, '../src'));

    const getProductsList = new lambda.Function(this, 'GetProductsListFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/getProductsList.handler',
      code,
      memorySize: 256,
      timeout: cdk.Duration.seconds(5),
    });

    const getProductsById = new lambda.Function(this, 'GetProductsByIdFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/getProductsById.handler',
      code,
      memorySize: 256,
      timeout: cdk.Duration.seconds(5),
    });

    const api = new apigw.RestApi(this, 'ProductsApi', {
      restApiName: 'Products Service',
      description: 'Serverless API for products',
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'OPTIONS'],
      },
    });

    const productsResource = api.root.addResource('products');
    productsResource.addMethod('GET', new apigw.LambdaIntegration(getProductsList));

    const productById = productsResource.addResource('{productId}');
    productById.addMethod('GET', new apigw.LambdaIntegration(getProductsById));

    new cdk.CfnOutput(this, 'ProductsApiUrl', { value: api.url ?? 'n/a' });
    new cdk.CfnOutput(this, 'GetProductsListUrl', { value: `${api.url}products` });
    new cdk.CfnOutput(this, 'GetProductsByIdUrl', { value: `${api.url}products/{productId}` });
  }
}