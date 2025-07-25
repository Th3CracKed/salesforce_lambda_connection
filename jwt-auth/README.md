# JSForce JWT Bearer Token Authentication for AWS Lambda

A JWT-based connection manager for JSForce optimized for AWS Lambda environments. This approach is more efficient than OAuth2 refresh tokens for serverless applications.

## Why JWT Bearer Token Flow for Lambda?

- **Stateless**: Perfect for Lambda's stateless nature
- **Performance**: No refresh token network calls
- **Security**: Short-lived tokens (3 minutes), no stored refresh tokens
- **Scalability**: Each invocation gets a fresh token
- **Efficiency**: Tokens cached for the duration of the Lambda container

## Features

- **JWT Token Generation**: Creates JWT assertions for Salesforce authentication
- **Token Caching**: Caches tokens for 3 minutes with 30-second buffer
- **Lambda Optimized**: Designed for AWS Lambda cold starts and warm containers
- **Multiple Orgs**: Support for multiple Salesforce orgs
- **TypeScript**: Full TypeScript support

## Prerequisites

### 1. Salesforce Connected App Setup

Create a Connected App in Salesforce with:

1. **Enable OAuth Settings**: Check "Enable OAuth Settings"
2. **Callback URL**: Use any valid URL (not used in JWT flow)
3. **OAuth Scopes**: Select required scopes (e.g., "Full access", "Perform requests at any time")
4. **Use digital signatures**: Check this option
5. **Upload Certificate**: Upload your public key certificate

### 2. Generate RSA Key Pair

```bash
# Generate private key
openssl genrsa -out private.key 2048

# Generate public key certificate
openssl req -new -x509 -key private.key -out public.crt -days 365

# Convert private key to PKCS#8 format (recommended)
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in private.key -out private_key.pem
```

## Installation

```bash
cd jwt-auth
npm install
```

## Environment Variables

Set these in your Lambda function:

```bash
SF_CLIENT_ID=your_connected_app_consumer_key
SF_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"
SF_USERNAME=your_salesforce_username
SF_INSTANCE_URL=https://your-instance.salesforce.com
```

**Important**: 
- Use the Consumer Key from your Connected App as CLIENT_ID
- Private key should include the full PEM format with headers
- Username should be the Salesforce user associated with the Connected App

## Usage

### Basic Usage

```typescript
import { JWTConnectionManager } from './jwt-connection-manager';

const config = {
  clientId: process.env.SF_CLIENT_ID!,
  privateKey: process.env.SF_PRIVATE_KEY!,
  username: process.env.SF_USERNAME!,
  instanceUrl: process.env.SF_INSTANCE_URL!
};

const connectionManager = JWTConnectionManager.getInstance();
const connection = await connectionManager.getConnection(config);

// Use the connection
const result = await connection.query('SELECT Id, Name FROM Account LIMIT 10');
```

### Lambda Handler Example

```typescript
export const handler = async (event, context) => {
  const connectionManager = JWTConnectionManager.getInstance();
  const connection = await connectionManager.getConnection(config);
  
  const accounts = await connection.query('SELECT Id, Name FROM Account LIMIT 5');
  
  return {
    statusCode: 200,
    body: JSON.stringify({ accounts: accounts.records })
  };
};
```

## How It Works

1. **JWT Creation**: Creates a JWT assertion with your private key
2. **Token Exchange**: Exchanges JWT for Salesforce access token
3. **Connection Creation**: Creates JSForce connection with access token
4. **Token Caching**: Caches tokens for 3 minutes to avoid regeneration
5. **Automatic Cleanup**: Removes expired tokens from cache

## JWT vs OAuth2 Refresh Token Comparison

| Aspect | JWT Bearer Token | OAuth2 Refresh Token |
|--------|------------------|---------------------|
| **Network Calls** | 1 (token exchange) | 2 (refresh + API call) |
| **Token Storage** | None required | Must store refresh token |
| **Token Lifetime** | 3 minutes | 2+ hours |
| **Security** | Higher (short-lived) | Lower (long-lived) |
| **Lambda Fit** | Perfect | Good |
| **Setup Complexity** | Medium (certificates) | Low |

## Benefits for Lambda

- **Faster Cold Starts**: No refresh token network calls
- **Better Security**: Short-lived tokens reduce exposure
- **Stateless Design**: No token state to manage
- **Container Reuse**: Tokens cached during warm container lifecycle
- **Predictable Performance**: Consistent token generation time

## Error Handling

Common issues and solutions:

1. **"JWT signature verification failed"**: Check private key format and Connected App certificate
2. **"user hasn't approved this consumer"**: Ensure user has access to the Connected App
3. **"invalid_client_id"**: Verify the Consumer Key from Connected App
4. **"invalid_grant"**: Check username and ensure user exists

## Security Best Practices

1. **Private Key Security**: Store private keys in AWS Secrets Manager or Parameter Store
2. **Least Privilege**: Grant minimal required OAuth scopes
3. **Certificate Rotation**: Regularly rotate certificates
4. **Environment Isolation**: Use different Connected Apps for different environments

## Performance Tips

1. **Container Reuse**: Lambda containers cache tokens for ~3 minutes
2. **Concurrent Requests**: Same container can serve multiple requests with cached token
3. **Token Cleanup**: Automatic cleanup prevents memory leaks
4. **Minimal Dependencies**: Only jsonwebtoken and jsforce required

## Monitoring

```typescript
// Get cache statistics
const stats = connectionManager.getCacheStats();
console.log(`Tokens: ${stats.valid} valid, ${stats.expired} expired`);

// Clear expired tokens manually
connectionManager.clearExpiredTokens();
```