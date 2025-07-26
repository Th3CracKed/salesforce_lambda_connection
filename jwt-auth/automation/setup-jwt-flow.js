#!/usr/bin/env node

/**
 * Automated JWT Bearer Token Flow Setup
 * 
 * This script uses existing Salesforce OAuth2 credentials to:
 * 1. Generate RSA key pair
 * 2. Create Connected App via Metadata API
 * 3. Configure JWT settings
 * 4. Output environment variables
 */

const jsforce = require('jsforce');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class JWTFlowAutomation {
  constructor(config) {
    this.config = config;
    this.conn = null;
    this.keyPair = null;
    this.connectedAppName = config.connectedAppName || 'JWT_Lambda_Integration';
    this.outputDir = config.outputDir || './jwt-output';
  }

  async run() {
    try {
      console.log('🚀 Starting JWT Bearer Token Flow automation...\n');
      
      // Step 1: Connect to Salesforce
      await this.connectToSalesforce();
      
      // Step 2: Generate RSA key pair
      await this.generateKeyPair();
      
      // Step 3: Create Connected App
      await this.createConnectedApp();
      
      // Step 4: Wait for activation
      await this.waitForActivation();
      
      // Step 5: Generate environment variables
      await this.generateEnvironmentConfig();
      
      console.log('✅ JWT Bearer Token Flow setup completed successfully!');
      console.log(`📁 Output files saved to: ${this.outputDir}`);
      
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      process.exit(1);
    }
  }

  async connectToSalesforce() {
    console.log('🔐 Connecting to Salesforce...');
    
    this.conn = new jsforce.Connection({
      loginUrl: this.config.loginUrl || 'https://login.salesforce.com'
    });

    if (this.config.accessToken) {
      // Use existing access token
      this.conn.accessToken = this.config.accessToken;
      this.conn.instanceUrl = this.config.instanceUrl;
    } else {
      // Login with username/password
      await this.conn.login(this.config.username, this.config.password);
    }

    // Test connection
    const userInfo = await this.conn.identity();
    console.log(`✅ Connected as: ${userInfo.display_name} (${userInfo.username})`);
  }

  async generateKeyPair() {
    console.log('🔑 Generating RSA key pair...');
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const privateKeyPath = path.join(this.outputDir, 'private.key');
    const publicCertPath = path.join(this.outputDir, 'public.crt');
    const pkcs8KeyPath = path.join(this.outputDir, 'private_key.pem');

    try {
      // Generate private key
      execSync(`openssl genrsa -out "${privateKeyPath}" 2048`, { stdio: 'pipe' });
      
      // Generate self-signed certificate
      const certSubject = `/C=US/ST=CA/L=San Francisco/O=${this.config.organization || 'Lambda Integration'}/CN=${this.connectedAppName}`;
      execSync(`openssl req -new -x509 -key "${privateKeyPath}" -out "${publicCertPath}" -days 365 -subj "${certSubject}"`, { stdio: 'pipe' });
      
      // Convert to PKCS#8 format
      execSync(`openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in "${privateKeyPath}" -out "${pkcs8KeyPath}"`, { stdio: 'pipe' });

      // Read the keys
      this.keyPair = {
        privateKey: fs.readFileSync(pkcs8KeyPath, 'utf8'),
        publicCert: fs.readFileSync(publicCertPath, 'utf8'),
        privateKeyPath: pkcs8KeyPath,
        publicCertPath: publicCertPath
      };

      console.log('✅ RSA key pair generated successfully');
      
    } catch (error) {
      throw new Error(`Failed to generate key pair: ${error.message}`);
    }
  }

  async createConnectedApp() {
    console.log('🏗️ Creating Connected App...');

    // Read certificate content for metadata
    const certContent = this.keyPair.publicCert
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\n/g, '');

    const connectedAppMetadata = {
      fullName: this.connectedAppName,
      label: this.config.appLabel || 'JWT Lambda Integration',
      description: 'Connected App for AWS Lambda JWT Bearer Token authentication',
      contactEmail: this.config.contactEmail || 'admin@example.com',
      oauthConfig: {
        callbackUrl: 'https://login.salesforce.com/services/oauth2/success',
        certificate: certContent,
        consumerKey: this.generateConsumerKey(),
        scopes: [
          'Api',
          'RefreshToken',
          'Id'
        ],
        useDigitalSignature: true
      }
    };

    try {
      // Deploy Connected App via Metadata API
      const deployResult = await this.deployConnectedApp(connectedAppMetadata);
      
      if (deployResult.success) {
        this.consumerKey = connectedAppMetadata.oauthConfig.consumerKey;
        console.log('✅ Connected App created successfully');
        console.log(`📋 Consumer Key: ${this.consumerKey}`);
      } else {
        throw new Error(`Deployment failed: ${JSON.stringify(deployResult.details)}`);
      }
      
    } catch (error) {
      throw new Error(`Failed to create Connected App: ${error.message}`);
    }
  }

  async deployConnectedApp(metadata) {
    // Create metadata package
    const packageXml = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>${metadata.fullName}</members>
        <name>ConnectedApp</name>
    </types>
    <version>58.0</version>
</Package>`;

    const connectedAppXml = `<?xml version="1.0" encoding="UTF-8"?>
<ConnectedApp xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>${metadata.label}</label>
    <description>${metadata.description}</description>
    <contactEmail>${metadata.contactEmail}</contactEmail>
    <oauthConfig>
        <callbackUrl>${metadata.oauthConfig.callbackUrl}</callbackUrl>
        <certificate>${metadata.oauthConfig.certificate}</certificate>
        <consumerKey>${metadata.oauthConfig.consumerKey}</consumerKey>
        <scopes>${metadata.oauthConfig.scopes.join('</scopes><scopes>')}</scopes>
        <useDigitalSignature>${metadata.oauthConfig.useDigitalSignature}</useDigitalSignature>
    </oauthConfig>
</ConnectedApp>`;

    // Create temporary directory for deployment
    const tempDir = path.join(this.outputDir, 'temp-metadata');
    const connectedAppsDir = path.join(tempDir, 'connectedApps');
    
    if (!fs.existsSync(connectedAppsDir)) {
      fs.mkdirSync(connectedAppsDir, { recursive: true });
    }

    // Write metadata files
    fs.writeFileSync(path.join(tempDir, 'package.xml'), packageXml);
    fs.writeFileSync(path.join(connectedAppsDir, `${metadata.fullName}.connectedApp`), connectedAppXml);

    try {
      // Deploy using JSForce Metadata API
      const zipBuffer = await this.createZipBuffer(tempDir);
      const deployResult = await this.conn.metadata.deploy(zipBuffer, { 
        singlePackage: true,
        checkOnly: false 
      });

      // Poll for completion
      let result = await this.conn.metadata.checkDeployStatus(deployResult.id);
      
      while (!result.done) {
        await this.sleep(2000);
        result = await this.conn.metadata.checkDeployStatus(deployResult.id);
        console.log(`⏳ Deployment status: ${result.stateDetail || 'In Progress'}`);
      }

      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });

      return result;
      
    } catch (error) {
      // Clean up temp directory on error
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      throw error;
    }
  }

  async createZipBuffer(sourceDir) {
    const archiver = require('archiver');
    const archive = archiver('zip');
    
    return new Promise((resolve, reject) => {
      const chunks = [];
      
      archive.on('data', chunk => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);
      
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  generateConsumerKey() {
    // Generate a consumer key similar to Salesforce format
    const prefix = '3MVG9';
    const randomPart = crypto.randomBytes(32).toString('hex');
    return prefix + randomPart.substring(0, 59); // Salesforce consumer keys are typically 64 chars
  }

  async waitForActivation() {
    console.log('⏳ Waiting for Connected App activation...');
    console.log('   (This typically takes 2-10 minutes)');
    
    // Wait 2 minutes initially
    await this.sleep(120000);
    
    // Test JWT token generation
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      try {
        await this.testJWTToken();
        console.log('✅ Connected App is active and ready');
        return;
      } catch (error) {
        attempts++;
        console.log(`   Attempt ${attempts}/${maxAttempts} - Still activating...`);
        
        if (attempts < maxAttempts) {
          await this.sleep(30000); // Wait 30 seconds between attempts
        }
      }
    }
    
    console.log('⚠️  Connected App may still be activating. You can test manually in a few minutes.');
  }

  async testJWTToken() {
    const jwt = require('jsonwebtoken');
    
    const jwtPayload = {
      iss: this.consumerKey,
      sub: this.config.username,
      aud: this.conn.instanceUrl,
      exp: Math.floor(Date.now() / 1000) + (3 * 60) // 3 minutes
    };

    const jwtToken = jwt.sign(jwtPayload, this.keyPair.privateKey, {
      algorithm: 'RS256'
    });

    // Test token exchange
    const tokenUrl = `${this.conn.instanceUrl}/services/oauth2/token`;
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
      throw new Error(`JWT test failed: ${response.status} - ${error}`);
    }

    const tokenData = await response.json();
    return tokenData.access_token;
  }

  async generateEnvironmentConfig() {
    console.log('📝 Generating environment configuration...');

    // Format private key for environment variable
    const privateKeyForEnv = this.keyPair.privateKey.replace(/\n/g, '\\n');

    const envConfig = `# Salesforce JWT Bearer Token Configuration
# Generated on ${new Date().toISOString()}

# Connected App Consumer Key
SF_CLIENT_ID="${this.consumerKey}"

# Private Key (keep this secure!)
SF_PRIVATE_KEY="${privateKeyForEnv}"

# Salesforce Username
SF_USERNAME="${this.config.username}"

# Salesforce Instance URL
SF_INSTANCE_URL="${this.conn.instanceUrl}"

# Optional: Audience (defaults to instance URL)
# SF_AUDIENCE="${this.conn.instanceUrl}"
`;

    const configPath = path.join(this.outputDir, '.env.jwt');
    fs.writeFileSync(configPath, envConfig);

    // Also create a JSON config file
    const jsonConfig = {
      clientId: this.consumerKey,
      username: this.config.username,
      instanceUrl: this.conn.instanceUrl,
      privateKeyPath: path.resolve(this.keyPair.privateKeyPath),
      publicCertPath: path.resolve(this.keyPair.publicCertPath),
      generatedAt: new Date().toISOString()
    };

    const jsonConfigPath = path.join(this.outputDir, 'jwt-config.json');
    fs.writeFileSync(jsonConfigPath, JSON.stringify(jsonConfig, null, 2));

    console.log('✅ Configuration files generated:');
    console.log(`   📄 Environment variables: ${configPath}`);
    console.log(`   📄 JSON configuration: ${jsonConfigPath}`);
    console.log(`   🔑 Private key: ${this.keyPair.privateKeyPath}`);
    console.log(`   📜 Public certificate: ${this.keyPair.publicCertPath}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
JWT Bearer Token Flow Automation

Usage:
  node setup-jwt-flow.js [options]

Options:
  --username <username>        Salesforce username
  --password <password>        Salesforce password (+ security token)
  --access-token <token>       Use existing access token instead of login
  --instance-url <url>         Salesforce instance URL (required with access token)
  --login-url <url>            Login URL (default: https://login.salesforce.com)
  --app-name <name>            Connected App name (default: JWT_Lambda_Integration)
  --app-label <label>          Connected App label
  --contact-email <email>      Contact email for Connected App
  --organization <org>         Organization name for certificate
  --output-dir <dir>           Output directory (default: ./jwt-output)
  --help, -h                   Show this help message

Examples:
  # Using username/password
  node setup-jwt-flow.js --username user@company.com --password mypassword123token

  # Using existing access token
  node setup-jwt-flow.js --access-token 00D... --instance-url https://mycompany.salesforce.com --username user@company.com

Environment Variables:
  SF_USERNAME, SF_PASSWORD, SF_ACCESS_TOKEN, SF_INSTANCE_URL, SF_LOGIN_URL
`);
    process.exit(0);
  }

  // Parse command line arguments
  const config = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    
    switch (key) {
      case '--username': config.username = value; break;
      case '--password': config.password = value; break;
      case '--access-token': config.accessToken = value; break;
      case '--instance-url': config.instanceUrl = value; break;
      case '--login-url': config.loginUrl = value; break;
      case '--app-name': config.connectedAppName = value; break;
      case '--app-label': config.appLabel = value; break;
      case '--contact-email': config.contactEmail = value; break;
      case '--organization': config.organization = value; break;
      case '--output-dir': config.outputDir = value; break;
    }
  }

  // Use environment variables as fallback
  config.username = config.username || process.env.SF_USERNAME;
  config.password = config.password || process.env.SF_PASSWORD;
  config.accessToken = config.accessToken || process.env.SF_ACCESS_TOKEN;
  config.instanceUrl = config.instanceUrl || process.env.SF_INSTANCE_URL;
  config.loginUrl = config.loginUrl || process.env.SF_LOGIN_URL;

  // Validate required parameters
  if (!config.username) {
    console.error('❌ Username is required (--username or SF_USERNAME)');
    process.exit(1);
  }

  if (!config.accessToken && !config.password) {
    console.error('❌ Either password or access token is required');
    process.exit(1);
  }

  if (config.accessToken && !config.instanceUrl) {
    console.error('❌ Instance URL is required when using access token');
    process.exit(1);
  }

  // Run automation
  const automation = new JWTFlowAutomation(config);
  await automation.run();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { JWTFlowAutomation };