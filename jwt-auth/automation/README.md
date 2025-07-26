# JWT Bearer Token Flow Automation

This automation script uses existing Salesforce OAuth2 credentials to automatically set up JWT Bearer Token Flow for AWS Lambda integration.

## What It Does

1. **🔐 Connects to Salesforce** using your existing OAuth2 credentials
2. **🔑 Generates RSA key pair** (private key + public certificate)
3. **🏗️ Creates Connected App** via Salesforce Metadata API
4. **⚙️ Configures JWT settings** automatically
5. **📝 Generates environment variables** ready for Lambda deployment
6. **✅ Tests the setup** to ensure everything works

## Prerequisites

- Node.js 18+ installed
- OpenSSL installed (for key generation)
- Existing Salesforce OAuth2 credentials (username/password or access token)
- System Administrator access in Salesforce org

## Installation

```bash
cd jwt-auth/automation
npm install
```

## Usage

### Option 1: Username/Password Authentication

```bash
node setup-jwt-flow.js \
  --username "your-admin@company.com" \
  --password "yourpassword123securitytoken" \
  --contact-email "admin@company.com" \
  --organization "Your Company"
```

### Option 2: Access Token Authentication

```bash
node setup-jwt-flow.js \
  --access-token "00D7F0000008gHq!ARMAQFJbKdoL9_..." \
  --instance-url "https://yourcompany.salesforce.com" \
  --username "integration-user@company.com" \
  --contact-email "admin@company.com"
```

### Option 3: Environment Variables

```bash
# Set environment variables
export SF_USERNAME="your-admin@company.com"
export SF_PASSWORD="yourpassword123securitytoken"

# Run automation
node setup-jwt-flow.js --contact-email "admin@company.com"
```

## Command Line Options

| Option | Description | Required |
|--------|-------------|----------|
| `--username` | Salesforce username | ✅ |
| `--password` | Salesforce password + security token | ✅* |
| `--access-token` | Existing access token | ✅* |
| `--instance-url` | Salesforce instance URL | ✅** |
| `--login-url` | Login URL (default: login.salesforce.com) | ❌ |
| `--app-name` | Connected App API name | ❌ |
| `--app-label` | Connected App display label | ❌ |
| `--contact-email` | Contact email for Connected App | ❌ |
| `--organization` | Organization name for certificate | ❌ |
| `--output-dir` | Output directory (default: ./jwt-output) | ❌ |

*Either password or access token is required  
**Required when using access token

## Output Files

The automation creates the following files in the output directory:

```
jwt-output/
├── .env.jwt                 # Environment variables for Lambda
├── jwt-config.json          # JSON configuration file
├── private_key.pem          # Private key (PKCS#8 format)
├── public.crt              # Public certificate
└── private.key             # Private key (original format)
```

### Environment Variables (.env.jwt)

```bash
# Salesforce JWT Bearer Token Configuration
SF_CLIENT_ID="3MVG9YDQS5WtC11..."
SF_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----"
SF_USERNAME="integration-user@company.com"
SF_INSTANCE_URL="https://yourcompany.salesforce.com"
```

## Process Flow

```mermaid
graph TD
    A[Start] --> B[Connect to Salesforce]
    B --> C[Generate RSA Key Pair]
    C --> D[Create Connected App Metadata]
    D --> E[Deploy via Metadata API]
    E --> F[Wait for Activation 2-10 min]
    F --> G[Test JWT Token Exchange]
    G --> H[Generate Config Files]
    H --> I[Complete ✅]
```

## What Gets Created in Salesforce

### Connected App Configuration

- **Name**: JWT_Lambda_Integration (or custom name)
- **OAuth Settings**: Enabled with digital signatures
- **Certificate**: Your generated public certificate
- **Callback URL**: https://login.salesforce.com/services/oauth2/success
- **OAuth Scopes**: 
  - Access and manage your data (api)
  - Perform requests on your behalf at any time (refresh_token, offline_access)
  - Access your basic information (id, profile, email, address, phone)

### Security Settings

- **IP Relaxation**: Enabled (required for Lambda)
- **Permitted Users**: All users may self-authorize
- **Digital Signatures**: Enabled with uploaded certificate

## Troubleshooting

### Common Issues

1. **"Insufficient Privileges"**
   - Ensure you're using System Administrator credentials
   - Check that Metadata API is enabled in your org

2. **"OpenSSL not found"**
   - Install OpenSSL: `brew install openssl` (macOS) or `apt-get install openssl` (Linux)
   - Ensure OpenSSL is in your PATH

3. **"Connected App activation timeout"**
   - Connected Apps can take 2-10 minutes to activate
   - You can test manually after the script completes

4. **"JWT signature verification failed"**
   - Usually resolves after Connected App activation period
   - Verify certificate was uploaded correctly

### Debug Mode

Run with additional logging:

```bash
DEBUG=1 node setup-jwt-flow.js --username "user@company.com" --password "pass123token"
```

## Security Considerations

### Private Key Security

- **Never commit private keys to version control**
- Store private keys in AWS Secrets Manager for production
- Use different key pairs for different environments

### Connected App Security

- The automation creates a Connected App with standard security settings
- Review and adjust OAuth policies after creation if needed
- Consider creating dedicated integration users for production

## Testing the Setup

After automation completes, test the JWT flow:

```bash
# Install dependencies in main jwt-auth directory
cd ../
npm install

# Test with generated config
node -e "
const { JWTConnectionManager } = require('./src/jwt-connection-manager');
const config = require('./automation/jwt-output/jwt-config.json');

(async () => {
  const manager = JWTConnectionManager.getInstance();
  const conn = await manager.getConnection({
    clientId: config.clientId,
    privateKey: require('fs').readFileSync(config.privateKeyPath, 'utf8'),
    username: config.username,
    instanceUrl: config.instanceUrl
  });
  
  const result = await conn.query('SELECT Id, Name FROM Account LIMIT 1');
  console.log('✅ JWT connection successful!', result.records);
})();
"
```

## Integration with Lambda

After running the automation:

1. **Copy environment variables** from `.env.jwt` to your Lambda function
2. **Store private key** in AWS Secrets Manager (recommended)
3. **Deploy your Lambda** with the JWT connection manager
4. **Test end-to-end** integration

## Advanced Usage

### Multiple Environments

```bash
# Development
node setup-jwt-flow.js \
  --username "dev-admin@company.com.dev" \
  --password "devpass123token" \
  --app-name "JWT_Lambda_Dev" \
  --output-dir "./jwt-dev"

# Production  
node setup-jwt-flow.js \
  --username "prod-admin@company.com" \
  --password "prodpass123token" \
  --app-name "JWT_Lambda_Prod" \
  --output-dir "./jwt-prod"
```

### Programmatic Usage

```javascript
const { JWTFlowAutomation } = require('./setup-jwt-flow');

const automation = new JWTFlowAutomation({
  username: 'admin@company.com',
  password: 'password123token',
  connectedAppName: 'Custom_JWT_App',
  outputDir: './custom-output'
});

await automation.run();
```

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review Salesforce setup logs in the output directory
3. Test JWT token generation manually
4. Verify Connected App settings in Salesforce Setup