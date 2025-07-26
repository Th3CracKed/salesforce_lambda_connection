/**
 * AWS Secrets Manager integration for secure private key storage
 * Production-ready implementation for Lambda environments
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

interface SecretsManagerConfig {
  region: string;
  secretName: string;
}



interface SalesforceJWTSecret {
  privateKey: string;
  clientId: string;
  username: string;
  instanceUrl: string;
  generatedAt: string;
  keyType: string;
  algorithm: string;
}

interface SalesforceConfig {
  clientId: string;
  privateKey: string;
  username: string;
  instanceUrl: string;
}

/**
 * Retrieve private key from AWS Secrets Manager
 */
export async function getPrivateKeyFromSecretsManager(
  config: SecretsManagerConfig
): Promise<string> {
  try {
    const client = new SecretsManagerClient({ region: config.region });
    const command = new GetSecretValueCommand({ SecretId: config.secretName });
    const response = await client.send(command);
    
    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }
    
    const secret: SalesforceJWTSecret = JSON.parse(response.SecretString);
    return secret.privateKey;
  } catch (error) {
    console.error('Failed to retrieve private key from Secrets Manager:', error);
    throw new Error(`Secrets Manager error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieve complete Salesforce configuration from AWS Secrets Manager
 */
export async function getCompleteSecretFromSecretsManager(
  config: SecretsManagerConfig
): Promise<SalesforceJWTSecret> {
  try {
    const client = new SecretsManagerClient({ region: config.region });
    const command = new GetSecretValueCommand({ SecretId: config.secretName });
    const response = await client.send(command);
    
    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }
    
    const secret: SalesforceJWTSecret = JSON.parse(response.SecretString);
    
    // Validate required fields
    const requiredFields = ['privateKey', 'clientId', 'username', 'instanceUrl'];
    const missing = requiredFields.filter(field => !secret[field as keyof SalesforceJWTSecret]);
    
    if (missing.length > 0) {
      throw new Error(`Secret is missing required fields: ${missing.join(', ')}`);
    }
    
    return secret;
  } catch (error) {
    console.error('Failed to retrieve complete secret from Secrets Manager:', error);
    throw new Error(`Secrets Manager error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}



/**
 * Get Salesforce configuration from AWS Secrets Manager or environment variables
 */
export async function getSalesforceConfig(useAwsSecrets = false): Promise<SalesforceConfig> {
  if (useAwsSecrets) {
    const region = process.env.AWS_REGION || 'us-east-1';
    const secretName = process.env.SF_SECRET_NAME;
    
    if (!secretName) {
      throw new Error('SF_SECRET_NAME environment variable is required when using AWS secrets');
    }
    
    // Get complete configuration from Secrets Manager
    const secret = await getCompleteSecretFromSecretsManager({ region, secretName });
    
    return {
      clientId: secret.clientId,
      privateKey: secret.privateKey,
      username: secret.username,
      instanceUrl: secret.instanceUrl
    };
  }

  // Use environment variables (fallback)
  const config = {
    clientId: process.env.SF_CLIENT_ID!,
    privateKey: process.env.SF_PRIVATE_KEY!,
    username: process.env.SF_USERNAME!,
    instanceUrl: process.env.SF_INSTANCE_URL!
  };
  
  // Validate required environment variables
  const missing = Object.entries(config)
    .filter(([_, value]) => !value)
    .map(([key]) => `SF_${key.toUpperCase()}`);
    
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return config;
}

/**
 * Auto-detect configuration source and retrieve Salesforce config
 */
export async function getAutoSalesforceConfig(): Promise<SalesforceConfig> {
  const useAwsSecrets = process.env.USE_AWS_SECRETS === 'true';
  
  console.log(`Using ${useAwsSecrets ? 'AWS Secrets Manager' : 'environment variables'} for configuration`);
  
  return getSalesforceConfig(useAwsSecrets);
}