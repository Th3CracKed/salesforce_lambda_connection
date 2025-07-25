import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { JWTConnectionManager } from './jwt-connection-manager';

interface JWTSalesforceConfig {
  clientId: string;
  privateKey: string;
  username: string;
  instanceUrl: string;
}

// Lambda handler using JWT Bearer Token Flow
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Get configuration from environment variables
    const config: JWTSalesforceConfig = {
      clientId: process.env.SF_CLIENT_ID!,
      privateKey: process.env.SF_PRIVATE_KEY!.replace(/\\n/g, '\n'), // Handle newlines in env vars
      username: process.env.SF_USERNAME!,
      instanceUrl: process.env.SF_INSTANCE_URL!
    };

    // Validate required environment variables
    if (!config.clientId || !config.privateKey || !config.username || !config.instanceUrl) {
      throw new Error('Missing required Salesforce configuration');
    }

    // Get connection manager instance
    const connectionManager = JWTConnectionManager.getInstance();
    
    // Clean up expired tokens
    connectionManager.clearExpiredTokens();

    // Get connection using JWT
    const connection = await connectionManager.getConnection(config);

    // Example: Query Salesforce
    const result = await connection.query('SELECT Id, Name FROM Account LIMIT 10');
    
    // Log cache statistics
    const stats = connectionManager.getCacheStats();
    console.log('JWT token cache stats:', stats);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        data: result.records,
        cacheStats: stats,
        authMethod: 'JWT Bearer Token'
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
        error: error instanceof Error ? error.message : 'Unknown error',
        authMethod: 'JWT Bearer Token'
      })
    };
  }
};

// Helper function for multiple org scenarios
export const getJWTConnectionForOrg = async (orgId: string) => {
  const config: JWTSalesforceConfig = {
    clientId: process.env[`SF_CLIENT_ID_${orgId}`]!,
    privateKey: process.env[`SF_PRIVATE_KEY_${orgId}`]!.replace(/\\n/g, '\n'),
    username: process.env[`SF_USERNAME_${orgId}`]!,
    instanceUrl: process.env[`SF_INSTANCE_URL_${orgId}`]!
  };

  const connectionManager = JWTConnectionManager.getInstance();
  return connectionManager.getConnection(config);
};