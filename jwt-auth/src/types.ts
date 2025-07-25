export interface JWTConfig {
  clientId: string;
  privateKey: string;
  username: string;
  instanceUrl: string;
  audience?: string;
}

export interface JWTTokenResponse {
  access_token: string;
  scope: string;
  instance_url: string;
  id: string;
  token_type: string;
}

export interface ConnectionOptions {
  version?: string;
  timeout?: number;
}

export interface CacheStats {
  total: number;
  valid: number;
  expired: number;
}