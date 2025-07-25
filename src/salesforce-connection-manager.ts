import jsforce from 'jsforce';

interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  loginUrl?: string;
}

interface ConnectionCache {
  connection: jsforce.Connection;
  expiresAt: number;
  accessToken: string;
}

export class SalesforceConnectionManager {
  private static instance: SalesforceConnectionManager;
  private connectionCache = new Map<string, ConnectionCache>();
  private readonly TOKEN_BUFFER_TIME = 5 * 60 * 1000; // 5 minutes buffer before expiry

  private constructor() {}

  public static getInstance(): SalesforceConnectionManager {
    if (!SalesforceConnectionManager.instance) {
      SalesforceConnectionManager.instance = new SalesforceConnectionManager();
    }
    return SalesforceConnectionManager.instance;
  }

  /**
   * Get or create a Salesforce connection using OAuth2
   * Reuses existing valid connections to avoid token regeneration
   */
  public async getConnection(
    config: OAuth2Config,
    refreshToken: string,
    cacheKey?: string
  ): Promise<jsforce.Connection> {
    const key = cacheKey || this.generateCacheKey(config, refreshToken);
    
    // Check if we have a valid cached connection
    const cached = this.connectionCache.get(key);
    if (cached && this.isConnectionValid(cached)) {
      console.log('Reusing cached Salesforce connection');
      return cached.connection;
    }

    // Create new connection
    console.log('Creating new Salesforce connection');
    const connection = await this.createConnection(config, refreshToken);
    
    // Cache the connection
    this.cacheConnection(key, connection);
    
    return connection;
  }

  private async createConnection(
    config: OAuth2Config,
    refreshToken: string
  ): Promise<jsforce.Connection> {
    const oauth2 = new jsforce.OAuth2({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      loginUrl: config.loginUrl || 'https://login.salesforce.com'
    });

    const connection = new jsforce.Connection({
      oauth2,
      refreshToken,
      version: '58.0' // Use latest API version
    });

    // Refresh the access token
    await connection.oauth2.refreshToken(refreshToken);
    
    return connection;
  }

  private cacheConnection(key: string, connection: jsforce.Connection): void {
    // Calculate expiry time (default to 2 hours if not available)
    const expiresIn = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    const expiresAt = Date.now() + expiresIn - this.TOKEN_BUFFER_TIME;

    this.connectionCache.set(key, {
      connection,
      expiresAt,
      accessToken: connection.accessToken || ''
    });
  }

  private isConnectionValid(cached: ConnectionCache): boolean {
    return Date.now() < cached.expiresAt && !!cached.accessToken;
  }

  private generateCacheKey(config: OAuth2Config, refreshToken: string): string {
    // Create a unique key based on client ID and refresh token hash
    const hash = Buffer.from(`${config.clientId}:${refreshToken}`).toString('base64');
    return `sf_conn_${hash}`;
  }

  /**
   * Clear expired connections from cache
   */
  public clearExpiredConnections(): void {
    const now = Date.now();
    for (const [key, cached] of this.connectionCache.entries()) {
      if (now >= cached.expiresAt) {
        this.connectionCache.delete(key);
        console.log(`Cleared expired connection: ${key}`);
      }
    }
  }

  /**
   * Clear all cached connections
   */
  public clearAllConnections(): void {
    this.connectionCache.clear();
    console.log('Cleared all cached connections');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { total: number; valid: number; expired: number } {
    const now = Date.now();
    let valid = 0;
    let expired = 0;

    for (const cached of this.connectionCache.values()) {
      if (now < cached.expiresAt) {
        valid++;
      } else {
        expired++;
      }
    }

    return {
      total: this.connectionCache.size,
      valid,
      expired
    };
  }
}