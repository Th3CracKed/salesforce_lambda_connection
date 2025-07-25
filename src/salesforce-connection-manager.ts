import jsforce from 'jsforce';

interface OAuth2Config {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    loginUrl?: string;
}

interface ConnectionCache {
    connection: jsforce.Connection;
    createdAt: number;
}

export class SalesforceConnectionManager {
    private static instance: SalesforceConnectionManager;
    private connectionCache = new Map<string, ConnectionCache>();
    private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes cache TTL

    private constructor() { }

    public static getInstance(): SalesforceConnectionManager {
        if (!SalesforceConnectionManager.instance) {
            SalesforceConnectionManager.instance = new SalesforceConnectionManager();
        }
        return SalesforceConnectionManager.instance;
    }

    /**
     * Get or create a Salesforce connection using OAuth2
     * Reuses existing connections, JSForce handles automatic token refresh
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
            refreshToken, // JSForce will automatically refresh when needed
            version: '58.0'
        });

        // Optional: Listen to refresh events for logging/monitoring
        connection.on('refresh', (accessToken, res) => {
            console.log('JSForce automatically refreshed access token');
        });

        return connection;
    }

    private cacheConnection(key: string, connection: jsforce.Connection): void {
        this.connectionCache.set(key, {
            connection,
            createdAt: Date.now()
        });
    }

    private isConnectionValid(cached: ConnectionCache): boolean {
        // Keep connections cached for 30 minutes, JSForce handles token refresh automatically
        return Date.now() - cached.createdAt < this.CACHE_TTL;
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
            if (now - cached.createdAt >= this.CACHE_TTL) {
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
            if (now - cached.createdAt < this.CACHE_TTL) {
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