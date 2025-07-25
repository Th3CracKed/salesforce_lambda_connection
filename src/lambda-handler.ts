import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { SalesforceConnectionManager } from './salesforce-connection-manager';

interface SalesforceConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
  loginUrl?: string;
}

// Lambda handler example
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Get configuration from environment variables
    const config: SalesforceConfig = {
      clientId: process.env.SF_CLIENT_ID!,
      clientSecret: process.env.SF_CLIENT_SECRET!,
      redirectUri: process.env.SF_REDIRECT_URI!,
      refreshToken: process.env.SF_REFRESH_TOKEN!,
      loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com'
    };

    // Get connection manager instance
    const connectionManager = SalesforceConnectionManager.getInstance();
    
    // Clean up expired connections periodically
    connectionManager.clearExpiredConnections();

    // Get or reuse connection
    const connection = await connectionManager.getConnection(
      config,
      config.refreshToken,
      'default' // Optional cache key for multiple orgs
    );

    // Example: Query Salesforce
    const result = await connection.query('SELECT Id, Name FROM Account LIMIT 10');
    
    // Log cache statistics
    const stats = connectionManager.getCacheStats();
    console.log('Connection cache stats:', stats);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        data: result.records,
        cacheStats: stats
      })
    };

  } catch (error) {
    console.error('Lambda execution error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

// Helper function for multiple org scenarios
export const getConnectionForOrg = async (orgId: string) => {
  const config: SalesforceConfig = {
    clientId: process.env[`SF_CLIENT_ID_${orgId}`]!,
    clientSecret: process.env[`SF_CLIENT_SECRET_${orgId}`]!,
    redirectUri: process.env[`SF_REDIRECT_URI_${orgId}`]!,
    refreshToken: process.env[`SF_REFRESH_TOKEN_${orgId}`]!,
    loginUrl: process.env[`SF_LOGIN_URL_${orgId}`] || 'https://login.salesforce.com'
  };

  const connectionManager = SalesforceConnectionManager.getInstance();
  return connectionManager.getConnection(config, config.refreshToken, orgId);
};