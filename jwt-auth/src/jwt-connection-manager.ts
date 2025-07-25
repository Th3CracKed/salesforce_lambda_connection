import jsforce from 'jsforce';
import jwt from 'jsonwebtoken';

interface JWTConfig {
  clientId: string;
  privateKey: string;
  username: string;
  instanceUrl: string;
  audience?: string;
}

interface JWTTokenCache {
  token: string;
  expiresAt: number;
}

export class JWTConnectionManager {
  private static instance: JWTConnectionManager;
  private tokenCache = new Map<string, JWTTokenCache>();
  private readonly TOKEN_LIFETIME = 3 * 60 * 1000; // 3 minutes
  private readonly CACHE_BUFFER = 30 * 1000; // 30 seconds buffer

  private constructor() {}

  public static getInstance(): JWTConnectionManager {
    if (!JWTConnectionManager.instance) {
      JWTConnectionManager.instance = new JWTConnectionManager();
    }
    return JWTConnectionManager.instance;
  }

  /**
   * Get Salesforce connection using JWT Bearer Token Flow
   * Optimized for AWS Lambda - no refresh tokens needed
   */
  public async getConnection(config: JWTConfig): Promise<jsforce.Connection> {
    const accessToken = await this.getAccessToken(config);
    
    const connection = new jsforce.Connection({
      serverUrl: config.instanceUrl,
      accessToken,
      version: '58.0'
    });

    return connection;
  }

  /**
   * Get or generate JWT access token
   */
  private async getAccessToken(config: JWTConfig): Promise<string> {
    const cacheKey = this.generateCacheKey(config);
    
    // Check cached token
    const cached = this.tokenCache.get(cacheKey);
    if (cached && this.isTokenValid(cached)) {
      console.log('Using cached JWT token');
      return cached.token;
    }

    // Generate new token
    console.log('Generating new JWT token');
    const token = await this.generateJWTToken(config);
    
    // Cache the token
    this.cacheToken(cacheKey, token);
    
    return token;
  }

  /**
   * Generate JWT token and exchange for Salesforce access token
   */
  private async generateJWTToken(config: JWTConfig): Promise<string> {
    // Create JWT assertion
    const jwtPayload = {
      iss: config.clientId,
      sub: config.username,
      aud: config.audience || config.instanceUrl,
      exp: Math.floor(Date.now() / 1000) + (this.TOKEN_LIFETIME / 1000)
    };

    const jwtToken = jwt.sign(jwtPayload, config.privateKey, {
      algorithm: 'RS256',
      header: {
        alg: 'RS256'
      }
    });

    // Exchange JWT for access token
    const tokenUrl = `${config.instanceUrl}/services/oauth2/token`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwtToken
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`JWT token exchange failed: ${response.status} - ${error}`);
    }

    const tokenData = await response.json();
    return tokenData.access_token;
  }

  private cacheToken(key: string, token: string): void {
    const expiresAt = Date.now() + this.TOKEN_LIFETIME - this.CACHE_BUFFER;
    
    this.tokenCache.set(key, {
      token,
      expiresAt
    });
  }

  private isTokenValid(cached: JWTTokenCache): boolean {
    return Date.now() < cached.expiresAt;
  }

  private generateCacheKey(config: JWTConfig): string {
    return `jwt_${config.clientId}_${config.username}`;
  }

  /**
   * Clear expired tokens from cache
   */
  public clearExpiredTokens(): void {
    const now = Date.now();
    for (const [key, cached] of this.tokenCache.entries()) {
      if (now >= cached.expiresAt) {
        this.tokenCache.delete(key);
        console.log(`Cleared expired JWT token: ${key}`);
      }
    }
  }

  /**
   * Clear all cached tokens
   */
  public clearAllTokens(): void {
    this.tokenCache.clear();
    console.log('Cleared all cached JWT tokens');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { total: number; valid: number; expired: number } {
    const now = Date.now();
    let valid = 0;
    let expired = 0;

    for (const cached of this.tokenCache.values()) {
      if (now < cached.expiresAt) {
        valid++;
      } else {
        expired++;
      }
    }

    return {
      total: this.tokenCache.size,
      valid,
      expired
    };
  }
}