# Secrets Manager Only Approach

## Why Secrets Manager Only is Better

You're absolutely right to question the Parameter Store + Secrets Manager approach. Here's why **Secrets Manager only** is the better choice:

### 🎯 **Simplified Architecture**
```
Before (Complex):
├── Secrets Manager (private key)
└── Parameter Store (username, instance-url, client-id)

After (Simple):
└── Secrets Manager (everything)
```

### 💰 **Cost Comparison**
- **Parameter Store**: $0.05 per 10,000 requests
- **Secrets Manager**: $0.40 per secret per month + $0.05 per 10,000 requests
- **Reality**: For Lambda, the difference is negligible (~$0.40/month)

### 🔒 **Security Benefits**
1. **Single source of truth** - All credentials in one place
2. **Consistent encryption** - Everything encrypted at rest
3. **Unified access control** - One IAM policy
4. **Automatic rotation** - Built-in rotation for all values
5. **Audit trail** - Single service to monitor

### ⚡ **Performance Benefits**
1. **Single API call** - Get all config in one request
2. **Reduced complexity** - No need to merge data from two sources
3. **Better caching** - Cache entire config object
4. **Fewer network calls** - Less latency

## Updated Secret Structure

### Complete Secret in Secrets Manager
```json
{
  "privateKey": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----",
  "clientId": "3MVG9YDQS5WtC11...",
  "username": "integration-user@company.com",
  "instanceUrl": "https://yourcompany.salesforce.com",
  "generatedAt": "2024-01-01T00:00:00.000Z",
  "keyType": "RSA-2048",
  "algorithm": "RS256"
}
```

### Environment Variables (Simplified)
```bash
# Production (Recommended)
USE_AWS_SECRETS=true
AWS_REGION=us-east-1
SF_SECRET_NAME=salesforce-jwt-prod

# Development (Fallback)
USE_AWS_SECRETS=false
SF_CLIENT_ID=3MVG9...
SF_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
SF_USERNAME=user@company.com
SF_INSTANCE_URL=https://company.salesforce.com
```

## Code Changes

### Lambda Handler (Simplified)
```typescript
// Before: Multiple AWS service calls
const secret = await getJWTSecretFromSecretsManager(config);
const parameters = await getParametersFromParameterStore(config);
const mergedConfig = { ...secret, ...parameters };

// After: Single AWS service call
const config = await getCompleteSecretFromSecretsManager(secretConfig);
```

### IAM Policy (Simplified)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:salesforce-jwt-*"
    }
  ]
}
```

## Migration Guide

### If You're Already Using Parameter Store

1. **Export existing parameters**:
```bash
aws ssm get-parameters-by-path \
  --path "/salesforce/jwt/prod" \
  --recursive \
  --with-decryption
```

2. **Update secret with complete config**:
```bash
aws secretsmanager update-secret \
  --secret-id salesforce-jwt-prod \
  --secret-string '{
    "privateKey": "...",
    "clientId": "...",
    "username": "...",
    "instanceUrl": "..."
  }'
```

3. **Update Lambda environment variables**:
```bash
# Remove these
SF_PARAMETER_PREFIX=/salesforce/jwt/prod

# Keep these
USE_AWS_SECRETS=true
SF_SECRET_NAME=salesforce-jwt-prod
```

4. **Clean up Parameter Store** (optional):
```bash
aws ssm delete-parameters \
  --names "/salesforce/jwt/prod/username" \
         "/salesforce/jwt/prod/instance-url" \
         "/salesforce/jwt/prod/client-id"
```

## Benefits Summary

### ✅ **Advantages of Secrets Manager Only**
- **Simpler architecture** - One service, one secret
- **Better security** - Consistent encryption and rotation
- **Easier management** - Single place to update credentials
- **Cleaner code** - One API call instead of multiple
- **Better monitoring** - Single service to audit
- **Cost effective** - Minimal difference for Lambda use case

### ❌ **Why Parameter Store Made Sense (But Doesn't Here)**
- **Cost optimization** - Only matters at very high scale
- **Performance** - Negligible difference for Lambda
- **Separation of concerns** - Over-engineering for this use case
- **Different access patterns** - Not relevant for our scenario

## Recommendation

**Use Secrets Manager only** for Salesforce JWT configuration. It's simpler, more secure, and the cost difference is negligible for typical Lambda workloads.

The automation has been updated to use this approach by default.