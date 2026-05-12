#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BasicAppStack } from '../lib/basic-vpc-stack';

const app = new cdk.App();

// Get environment variables or use defaults
const projectName = process.env.PROJECT_NAME || 'aws-project';
const environment = process.env.ENVIRONMENT || 'dev';
const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1';

// Get VPC and subnet information from context or environment variables
const vpcId = app.node.tryGetContext('vpcId') || process.env.VPC_ID;
const subnetIdsString = app.node.tryGetContext('subnetIds') || process.env.SUBNET_IDS;
const subnetIds = subnetIdsString ? subnetIdsString.split(',') : [];

// Validate required parameters
if (!vpcId) {
  throw new Error('VPC ID must be provided via context (-c vpcId=vpc-12345) or VPC_ID environment variable');
}

if (subnetIds.length === 0) {
  throw new Error('Subnet IDs must be provided via context (-c subnetIds=subnet-1,subnet-2) or SUBNET_IDS environment variable');
}

// Create the application stack
new BasicAppStack(app, `${projectName}-app-stack`, {
  projectName,
  environment,
  vpcId,
  subnetIds,
  env: {
    account,
    region,
  },
  description: `Application infrastructure for ${projectName} in ${environment} environment`,
});

app.synth();