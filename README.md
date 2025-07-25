# JSForce OAuth2 Connection Manager for AWS Lambda

A connection manager for JSForce that optimizes OAuth2 connections in AWS Lambda environments by reusing connections and avoiding unnecessary token generation.

## Features

- **Connection Reusing**: Caches valid connections to avoid regenerating access tokens
- **Lambda Optimized**: Designed for AWS Lambda cold starts and concurrent executions
- **Multiple Orgs**: Support for multiple Salesforce orgs with separate cache keys
- **Automatic Cleanup**: Removes expired connections from cache
- **TypeScript**: Full TypeScript support with type definitions

## Installation

```bash
npm install jsforce
npm install --save-dev typescript @types/node
```

## Environment Variables

Set these environment variables in your Lambda function:

```
SF_CLIENT_ID=your_connected_app_client_id
SF_CLIENT_SECRET=your_connected_app_client_secret
SF_REDIRECT_URI=your_redirect_uri
SF_REFRESH_TOKEN=your_refresh_token
SF_LOGIN_URL=https://login.salesforce.com (optional, defaults to login.salesforce.com)
```

## Usage

### Basic Usage

```typescript
import { SalesforceConnectionManager } from './salesforce-connection-manager';

const config = {
  clientId: process.env.SF_CLIENT_ID!,
  clientSecret: process.env.SF_CLIENT_SECRET!,
  redirectUri: process.env.SF_REDIRECT_URI!,
  refreshToken: process.env.SF_REFRESH_TOKEN!
};

const connectionManager = SalesforceConnectionManager.getInstance();
const connection = await connectionManager.getConnection(config, config.refreshToken);

// Use the connection
const result = await connection.query('SELECT Id, Name FROM Account LIMIT 10');
```

### Multiple Orgs

```typescript
// Use different cache keys for different orgs
const prodConnection = await connectionManager.getConnection(config, refreshToken, 'prod');
const sandboxConnection = await connectionManager.getConnection(config, refreshToken, 'sandbox');
```

### Cache Management

```typescript
// Get cache statistics
const stats = connectionManager.getCacheStats();
console.log(`Total: ${stats.total}, Valid: ${stats.valid}, Expired: ${stats.expired}`);

// Clear expired connections
connectionManager.clearExpiredConnections();

// Clear all connections
connectionManager.clearAllConnections();
```

## How It Works

1. **Singleton Pattern**: Uses singleton pattern to maintain connection cache across Lambda invocations
2. **JSForce Auto-Refresh**: JSForce automatically refreshes expired tokens when making API calls (official behavior)
3. **Connection Reuse**: Caches connection objects for 30 minutes to avoid creating multiple connections
4. **Cache Key**: Generates unique cache keys based on client ID and refresh token
5. **Event Monitoring**: Optionally listens to refresh events for logging and monitoring

## Benefits for Lambda

- **Reduced Cold Start Impact**: Reuses connection objects across invocations
- **Automatic Token Management**: JSForce handles all token refresh automatically
- **Better Performance**: Faster response times by avoiding connection recreation
- **Cost Optimization**: Reduces connection overhead and improves efficiency

## Best Practices

1. Set appropriate Lambda timeout (recommend 30+ seconds for initial connection)
2. Use environment variables for sensitive configuration
3. Implement proper error handling for network issues
4. Monitor cache hit rates using the provided statistics
5. Clear expired connections periodically to manage memory

## Error Handling

The connection manager handles common scenarios:
- Network timeouts during token refresh
- Invalid refresh tokens
- Expired access tokens
- Salesforce API limits

Always wrap connection usage in try-catch blocks for robust error handling.