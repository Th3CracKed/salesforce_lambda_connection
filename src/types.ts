export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  loginUrl?: string;
}

export interface SalesforceCredentials {
  refreshToken: string;
  accessToken?: string;
  instanceUrl?: string;
}

export interface ConnectionOptions {
  cacheKey?: string;
  version?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface CacheStats {
  total: number;
  valid: number;
  expired: number;
}