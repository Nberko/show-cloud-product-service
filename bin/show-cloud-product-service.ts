#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ShowCloudProductServiceStack } from '../lib/show-cloud-product-service-stack';
import { ImportServiceStack } from '../lib/import-service-stack';

const app = new cdk.App();
new ShowCloudProductServiceStack(app, 'ShowCloudProductServiceStack', {});

new ImportServiceStack(app, 'ImportServiceStack', {});