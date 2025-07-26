# Deployment Guide for Salesforce JWT Lambda

This guide covers deploying the Salesforce JWT Bearer Token Lambda function with AWS Secrets Manager integration.

## Prerequisites

1. **AWS CLI configured** with appropriate permissions
2. **Node.js 18+** installed
3. **Salesforce JWT setup completed** (run automation first)
4. **AWS permissions** for Secrets Manager and Parameter Store

## Deployment Options

### Option 1: AWS SAM (Recommended)

#### Install AWS SAM CLI
```bash
# macOS
brew install aws-sam-cli

# Linux/Windows - see AWS documentation
```

#### Deploy with SAM
```bash
# Build the application
cd jwt-auth
npm run build

# Deploy to development
sam deploy --template-file deployment/sam-template.yaml \
  --stack-name salesforce-jwt-dev \
  --parameter-overrides Stage=dev \
  --capabilities CAPABILITY_IAM \
  --region us-east-1

# Deploy to production
sam deploy --template-file deployment/sam-template.yaml \
  --stack-name salesforce-jwt-prod \
  --parameter-overrides Stage=prod \
  --capabilities CAPABILITY_IAM \
  --region us-east-1
```

### Option 2: Serverless Framework

#### Install Serverless Framework
```bash
npm install -g serverless
cd jwt-auth
npm install serverless-plugin-typescript serverless-offline --save-dev
```

#### Deploy with Serverless
```bash
# Deploy to development
serverless deploy --stage dev --region us-east-1

# Deploy to production
serverless deploy --stage prod --region us-east-1
```

### Option 3: Manual Lambda Deployment

#### Create deployment package
```bash
cd jwt-auth
npm run build
zip -r lambda-deployment.zip dist/ node_modules/ package.json
```

#### Create Lambda function via AWS CLI
```bash
aws lambda create-function \
  --function-name salesforce-jwt-dev \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR-ACCOUNT:role/lambda-execution-role \
  --handler dist/lambda-handler.handler \
  --zip-file fileb://lambda-deployment.zip \
  --timeout 30 \
  --memory-size 512 \
  --environment Variables='{
    "USE_AWS_SECRETS":"true",
    "AWS_REGION":"us-east-1",
    "SF_SECRET_NAME":"salesforce-jwt-dev",
    "SF_PARAMETER_PREFIX":"/salesforce/jwt/dev"
  }'
```

## Setup AWS Secrets (Required)

### Run Automation with AWS Secrets
```bash
cd jwt-auth/automation

# Setup with AWS secrets storage
node setup-jwt-flow.js \
  --username "admin@company.com" \
  --password "password123token" \
  --use-aws-secrets true \
  --aws-region us-east-1 \
  --secret-name "salesforce-jwt-dev" \
  --parameter-prefix "/salesforce/jwt/dev"
```

### Manual Secrets Setup (if needed)
```bash
# Create secret in Secrets Manager
aws secretsmanager create-secret \
  --name "salesforce-jwt-dev" \
  --description "Salesforce JWT private key for development" \
  --secret-string '{
    "privateKey": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
    "clientId": "3MVG9...",
    "generatedAt": "2024-01-01T00:00:00.000Z",
    "keyType": "RSA-2048",
    "algorithm": "RS256"
  }'

# Create parameters in Parameter Store
aws ssm put-parameter \
  --name "/salesforce/jwt/dev/username" \
  --value "integration-user@company.com" \
  --type "String" \
  --description "Salesforce username"

aws ssm put-parameter \
  --name "/salesforce/jwt/dev/instance-url" \
  --value "https://yourcompany.salesforce.com" \
  --type "String" \
  --description "Salesforce instance URL"

aws ssm put-parameter \
  --name "/salesforce/jwt/dev/client-id" \
  --value "3MVG9..." \
  --type "String" \
  --description "Connected App Consumer Key"
```

## IAM Permissions

### Lambda Execution Role
Create an IAM role with the following policies:

#### Trust Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

#### Permissions Policy
Use the provided `aws-iam-policy.json` file or create inline policy:

```bash
aws iam create-role \
  --role-name salesforce-jwt-lambda-role \
  --assume-role-policy-document file://trust-policy.json

aws iam put-role-policy \
  --role-name salesforce-jwt-lambda-role \
  --policy-name SalesforceJWTLambdaPolicy \
  --policy-document file://aws-iam-policy.json

aws iam attach-role-policy \
  --role-name salesforce-jwt-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

## Environment Variables

### Required Environment Variables
```bash
USE_AWS_SECRETS=true
AWS_REGION=us-east-1
SF_SECRET_NAME=salesforce-jwt-dev
SF_PARAMETER_PREFIX=/salesforce/jwt/dev
```

### Optional Environment Variables
```bash
NODE_OPTIONS=--enable-source-maps
LOG_LEVEL=info
```

## Testing the Deployment

### Test via AWS CLI
```bash
# Test the main function
aws lambda invoke \
  --function-name salesforce-jwt-dev \
  --payload '{"httpMethod":"GET","path":"/api/salesforce"}' \
  response.json

cat response.json

# Test health check
aws lambda invoke \
  --function-name salesforce-jwt-health-dev \
  --payload '{"httpMethod":"GET","path":"/health"}' \
  health-response.json

cat health-response.json
```

### Test via API Gateway (if deployed)
```bash
# Get API Gateway URL from stack outputs
API_URL=$(aws cloudformation describe-stacks \
  --stack-name salesforce-jwt-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

# Test health endpoint
curl "$API_URL/health"

# Test Salesforce API endpoint
curl "$API_URL/api/salesforce"
```

## Monitoring and Logging

### CloudWatch Logs
```bash
# View logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/salesforce-jwt"

# Tail logs
aws logs tail /aws/lambda/salesforce-jwt-dev --follow
```

### CloudWatch Metrics
Monitor these key metrics:
- **Duration**: Function execution time
- **Errors**: Error count and rate
- **Throttles**: Throttling events
- **Invocations**: Total invocation count

### Custom Metrics (Optional)
Add custom metrics to track:
- JWT token cache hit rate
- Salesforce API response times
- Authentication success/failure rates

## Troubleshooting

### Common Issues

1. **"Unable to import module 'lambda-handler'"**
   - Ensure `npm run build` was executed
   - Check that `dist/` directory exists in deployment package

2. **"Secrets Manager error: AccessDenied"**
   - Verify IAM permissions for Secrets Manager
   - Check secret name and region match

3. **"Parameter Store error: ParameterNotFound"**
   - Verify parameter names and paths
   - Ensure parameters exist in correct region

4. **"JWT signature verification failed"**
   - Check that Connected App is fully activated (2-10 minutes)
   - Verify private key format in Secrets Manager

### Debug Mode
Enable debug logging:
```bash
aws lambda update-function-configuration \
  --function-name salesforce-jwt-dev \
  --environment Variables='{
    "USE_AWS_SECRETS":"true",
    "AWS_REGION":"us-east-1",
    "SF_SECRET_NAME":"salesforce-jwt-dev",
    "SF_PARAMETER_PREFIX":"/salesforce/jwt/dev",
    "LOG_LEVEL":"debug"
  }'
```

## Security Best Practices

1. **Use different secrets for different environments**
2. **Rotate certificates regularly (every 6-12 months)**
3. **Monitor access to secrets and parameters**
4. **Use least privilege IAM policies**
5. **Enable CloudTrail for audit logging**
6. **Consider VPC endpoints for private access**

## Cost Optimization

1. **Right-size memory allocation** (start with 512MB)
2. **Monitor duration** and adjust timeout accordingly
3. **Use provisioned concurrency** for consistent performance (if needed)
4. **Implement proper error handling** to avoid unnecessary retries
5. **Cache connections** effectively (already implemented)

## Multi-Environment Setup

### Development
```bash
# Secrets: salesforce-jwt-dev
# Parameters: /salesforce/jwt/dev/*
# Stack: salesforce-jwt-dev
```

### Staging
```bash
# Secrets: salesforce-jwt-staging
# Parameters: /salesforce/jwt/staging/*
# Stack: salesforce-jwt-staging
```

### Production
```bash
# Secrets: salesforce-jwt-prod
# Parameters: /salesforce/jwt/prod/*
# Stack: salesforce-jwt-prod
```

Each environment should use separate Salesforce orgs and Connected Apps for proper isolation.