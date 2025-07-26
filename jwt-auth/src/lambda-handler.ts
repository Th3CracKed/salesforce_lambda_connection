import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { JWTConnectionManager } from './jwt-connection-manager';
import { getAutoSalesforceConfig } from './utils/secrets-manager';

// Lambda handler using JWT Bearer Token Flow with AWS Secrets Manager
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('🚀 Lambda invocation started');
    
    // Get configuration from AWS Secrets Manager or environment variables
    const config = await getAutoSalesforceConfig();
    console.log(`✅ Configuration loaded for user: ${config.username}`);

    // Get connection manager instance
    const connectionManager = JWTConnectionManager.getInstance();
    
    // Clean up expired tokens
    connectionManager.clearExpiredTokens();

    // Get connection using JWT
    console.log('🔐 Establishing JWT connection...');
    const connection = await connectionManager.getConnection(config);
    console.log('✅ JWT connection established');

    // Example: Query Salesforce
    console.log('📊 Executing Salesforce query...');
    const result = await connection.query('SELECT Id, Name FROM Account LIMIT 10');
    console.log(`✅ Query completed: ${result.records.length} records returned`);
    
    // Log cache statistics
    const stats = connectionManager.getCacheStats();
    console.log('📈 JWT token cache stats:', stats);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': context.awsRequestId
      },
      body: JSON.stringify({
        success: true,
        data: result.records,
        cacheStats: stats,
        authMethod: 'JWT Bearer Token',
        configSource: process.env.USE_AWS_SECRETS === 'true' ? 'AWS Secrets Manager' : 'Environment Variables',
        requestId: context.awsRequestId,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Lambda execution error:', error);
    
    // Enhanced error logging for troubleshooting
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': context.awsRequestId
      },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        authMethod: 'JWT Bearer Token',
        configSource: process.env.USE_AWS_SECRETS === 'true' ? 'AWS Secrets Manager' : 'Environment Variables',
        requestId: context.awsRequestId,
        timestamp: new Date().toISOString()
      })
    };
  }
};

// Helper function for multiple org scenarios
export const getJWTConnectionForOrg = async (orgId: string) => {
  const useAwsSecrets = process.env.USE_AWS_SECRETS === 'true';
  
  let config;
  
  if (useAwsSecrets) {
    // Use org-specific AWS secrets
    const originalSecretName = process.env.SF_SECRET_NAME;
    const originalParameterPrefix = process.env.SF_PARAMETER_PREFIX;
    
    // Temporarily override environment variables for this org
    process.env.SF_SECRET_NAME = `${originalSecretName}-${orgId}`;
    process.env.SF_PARAMETER_PREFIX = `${originalParameterPrefix}-${orgId}`;
    
    try {
      config = await getAutoSalesforceConfig();
    } finally {
      // Restore original values
      process.env.SF_SECRET_NAME = originalSecretName;
      process.env.SF_PARAMETER_PREFIX = originalParameterPrefix;
    }
  } else {
    // Use org-specific environment variables
    config = {
      clientId: process.env[`SF_CLIENT_ID_${orgId}`]!,
      privateKey: process.env[`SF_PRIVATE_KEY_${orgId}`]!.replace(/\\n/g, '\n'),
      username: process.env[`SF_USERNAME_${orgId}`]!,
      instanceUrl: process.env[`SF_INSTANCE_URL_${orgId}`]!
    };
  }

  const connectionManager = JWTConnectionManager.getInstance();
  return connectionManager.getConnection(config);
};

// Health check handler
export const healthCheck = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const config = await getAutoSalesforceConfig();
    const connectionManager = JWTConnectionManager.getInstance();
    
    // Test connection without making actual API calls
    const connection = await connectionManager.getConnection(config);
    const stats = connectionManager.getCacheStats();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': context.awsRequestId
      },
      body: JSON.stringify({
        status: 'healthy',
        configSource: process.env.USE_AWS_SECRETS === 'true' ? 'AWS Secrets Manager' : 'Environment Variables',
        cacheStats: stats,
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };
  } catch (error) {
    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': context.awsRequestId
      },
      body: JSON.stringify({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };
  }
};