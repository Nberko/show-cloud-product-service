import * as cdk from 'aws-cdk-lib';
import { ShowCloudProductServiceStack } from '../lib/show-cloud-product-service-stack';
import { ImportServiceStack } from '../lib/import-service-stack';

const app = new cdk.App();

// Use CDK environment variables, or explicitly set account/region here
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || '833376855827',
  region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'eu-central-1',
};

const product = new ShowCloudProductServiceStack(app, 'ShowCloudProductServiceStack', { env });

new ImportServiceStack(app, 'ImportServiceStack', {
  env,
  catalogQueue: product.catalogQueue,
});