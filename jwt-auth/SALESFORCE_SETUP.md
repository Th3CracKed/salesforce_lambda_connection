# Salesforce Connected App Setup for JWT Bearer Token Flow

This guide walks you through setting up a Salesforce Connected App for JWT Bearer Token authentication with AWS Lambda.

## Prerequisites

- Salesforce org with System Administrator access
- OpenSSL installed on your machine
- Basic understanding of public/private key cryptography

## Step 1: Generate RSA Key Pair

First, generate the RSA key pair that will be used for JWT signing:

### 1.1 Generate Private Key

```bash
# Generate a 2048-bit RSA private key
openssl genrsa -out private.key 2048
```

### 1.2 Generate Public Certificate

```bash
# Create a self-signed certificate (valid for 365 days)
openssl req -new -x509 -key private.key -out public.crt -days 365
```

When prompted, enter the following information:
- **Country Name**: US (or your country code)
- **State**: Your state/province
- **City**: Your city
- **Organization Name**: Your company name
- **Organizational Unit**: IT Department (or relevant unit)
- **Common Name**: Your domain or app name (e.g., "Lambda JWT App")
- **Email Address**: Your email address

### 1.3 Convert Private Key (Optional but Recommended)

```bash
# Convert to PKCS#8 format for better compatibility
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in private.key -out private_key.pem
```

### 1.4 Verify Your Files

You should now have:
- `private.key` or `private_key.pem` (keep this secret!)
- `public.crt` (this will be uploaded to Salesforce)

## Step 2: Create Connected App in Salesforce

### 2.1 Navigate to App Manager

1. Log into your Salesforce org
2. Click the **Setup** gear icon (top right)
3. Go to **Apps** → **App Manager**
4. Click **New Connected App**

### 2.2 Basic Information

Fill in the basic app information:

- **Connected App Name**: `JWT Lambda Integration` (or your preferred name)
- **API Name**: `JWT_Lambda_Integration` (auto-generated, can be modified)
- **Contact Email**: Your email address
- **Description**: `Connected App for AWS Lambda JWT Bearer Token authentication`

### 2.3 API (Enable OAuth Settings)

In the **API (Enable OAuth Settings)** section:

1. **✅ Check "Enable OAuth Settings"**

2. **Callback URL**: 
   ```
   https://login.salesforce.com/services/oauth2/success
   ```
   *Note: This URL is not used in JWT flow but is required*

3. **✅ Check "Use digital signatures"**

4. **Upload Certificate**: 
   - Click **Choose File**
   - Select your `public.crt` file
   - Upload it

5. **Selected OAuth Scopes**: Add the following scopes by selecting them and clicking **Add**:
   - `Access and manage your data (api)`
   - `Perform requests on your behalf at any time (refresh_token, offline_access)`
   - `Access your basic information (id, profile, email, address, phone)`
   
   *Optional additional scopes based on your needs:*
   - `Full access (full)` - if you need comprehensive access
   - `Access custom applications (visualforce)` - if using Visualforce
   - `Access Lightning applications (lightning)` - if using Lightning

### 2.4 Web App Settings (Optional)

You can leave these settings as default or configure as needed:
- **Start URL**: Leave blank
- **Mobile App Settings**: Not required for Lambda integration

### 2.5 Save the Connected App

1. Click **Save**
2. You'll see a message: "New Connected App has been created"
3. **Important**: It may take 2-10 minutes for the Connected App to be fully activated

## Step 3: Configure Connected App Policies

### 3.1 Edit Policies

After saving, you'll be redirected to the Connected App detail page:

1. Click **Edit Policies**

2. **OAuth Policies**:
   - **Permitted Users**: Select based on your security requirements:
     - `All users may self-authorize` (easiest for testing)
     - `Admin approved users are pre-authorized` (more secure)
     - `All users may self-authorize` (if you want broader access)

3. **IP Relaxation**:
   - Select `Relax IP restrictions` (recommended for Lambda as IP addresses vary)

4. **Refresh Token Policy**:
   - Select `Refresh token is valid until revoked` (not critical for JWT flow)

5. Click **Save**

## Step 4: Get Consumer Key

### 4.1 View Consumer Key

1. On the Connected App detail page, find the **API (Enable OAuth Settings)** section
2. Copy the **Consumer Key** (this is your `SF_CLIENT_ID`)
3. **Important**: Keep this secure - it's like a username for your app

### 4.2 Consumer Secret (Not Needed for JWT)

- The Consumer Secret is not required for JWT Bearer Token flow
- JWT flow uses your private key instead of the consumer secret

## Step 5: Create Integration User (Recommended)

For production, create a dedicated integration user:

### 5.1 Create User

1. Go to **Setup** → **Users** → **Users**
2. Click **New User**
3. Fill in required fields:
   - **First Name**: `Integration`
   - **Last Name**: `User JWT`
   - **Email**: Use a monitored email address
   - **Username**: `integration.jwt@yourcompany.com.sandbox` (adjust for your org)
   - **Nickname**: `IntegrationJWT`
   - **Profile**: `System Administrator` (or custom profile with required permissions)

4. **✅ Uncheck "Generate new password and notify user immediately"**
5. Set a strong password
6. Click **Save**

### 5.2 Assign Permission Sets (If Needed)

If using a custom profile, assign necessary permission sets:
1. Go to the user detail page
2. Click **Permission Set Assignments**
3. Click **Edit Assignments**
4. Add required permission sets

## Step 6: Test Configuration

### 6.1 Prepare Environment Variables

Create your environment variables:

```bash
# Consumer Key from Connected App
SF_CLIENT_ID="3MVG9..."

# Your private key (format properly for environment variable)
SF_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...
-----END PRIVATE KEY-----"

# Integration user username
SF_USERNAME="integration.jwt@yourcompany.com.sandbox"

# Your Salesforce instance URL
SF_INSTANCE_URL="https://yourinstance.salesforce.com"
```

### 6.2 Format Private Key for Environment Variable

```bash
# Convert private key to single line for environment variable
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' private_key.pem
```

## Step 7: Troubleshooting Common Issues

### Issue 1: "JWT signature verification failed"

**Causes:**
- Wrong private key format
- Certificate not uploaded correctly
- Private/public key mismatch

**Solutions:**
- Verify certificate upload in Connected App
- Check private key format (should include headers)
- Regenerate key pair if needed

### Issue 2: "User hasn't approved this consumer"

**Causes:**
- Connected App not activated yet
- User doesn't have access to the Connected App
- OAuth policies too restrictive

**Solutions:**
- Wait 2-10 minutes for Connected App activation
- Check OAuth policies (set to "All users may self-authorize" for testing)
- Verify user has necessary permissions

### Issue 3: "Invalid client_id"

**Causes:**
- Wrong Consumer Key
- Connected App not saved properly

**Solutions:**
- Double-check Consumer Key from Connected App
- Verify Connected App is saved and active

### Issue 4: "Invalid grant"

**Causes:**
- Wrong username
- User doesn't exist
- Username format incorrect

**Solutions:**
- Verify username exists in the org
- Check username format (should include full username with org suffix)
- Ensure user is active

## Step 8: Security Best Practices

### 8.1 Private Key Security

- **Never commit private keys to version control**
- Store private keys in AWS Secrets Manager or Parameter Store
- Use different key pairs for different environments
- Rotate certificates regularly (every 6-12 months)

### 8.2 Connected App Security

- Use least privilege principle for OAuth scopes
- Create dedicated integration users
- Monitor Connected App usage in Setup → Apps → Connected Apps OAuth Usage
- Set up IP restrictions if Lambda IPs are predictable

### 8.3 Monitoring

- Monitor authentication failures in Setup → Security → Login History
- Set up alerts for unusual authentication patterns
- Regularly review Connected App permissions

## Step 9: Environment-Specific Setup

### Development/Sandbox

- Use sandbox org
- More relaxed security settings for testing
- Can use admin user for initial testing

### Production

- Use production org
- Dedicated integration user
- Stricter OAuth policies
- IP restrictions if possible
- Certificate stored in AWS Secrets Manager

## Verification Checklist

Before deploying to Lambda, verify:

- [ ] Connected App created and saved
- [ ] Certificate uploaded successfully
- [ ] Consumer Key copied correctly
- [ ] Private key formatted properly
- [ ] OAuth scopes include required permissions
- [ ] OAuth policies allow your user
- [ ] IP relaxation enabled (for Lambda)
- [ ] Integration user created (for production)
- [ ] Test JWT token generation works locally

## Next Steps

After completing this setup:

1. Test the JWT connection locally
2. Deploy to AWS Lambda
3. Configure environment variables in Lambda
4. Test end-to-end integration
5. Set up monitoring and alerting

## Support Resources

- [Salesforce JWT Bearer Token Flow Documentation](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_jwt_flow.htm)
- [Connected Apps Documentation](https://help.salesforce.com/s/articleView?id=sf.connected_app_overview.htm)
- [OAuth Scopes Reference](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_tokens_scopes.htm)