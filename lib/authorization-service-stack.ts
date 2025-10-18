import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export class AuthorizationServiceStack extends cdk.Stack {
  public readonly basicAuthorizer: lambda.IFunction;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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
    this.basicAuthorizer = new NodejsFunction(this, 'BasicAuthorizerFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../src/handlers/basicAuthorizer.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      environment: credentials,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Output the authorizer function ARN
    new cdk.CfnOutput(this, 'BasicAuthorizerArn', {
      value: this.basicAuthorizer.functionArn,
      description: 'ARN of the Basic Authorizer Lambda',
    });
  }
}
