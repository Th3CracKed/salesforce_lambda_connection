#!/bin/bash

# Quick Setup Script for JWT Bearer Token Flow
# This script provides an interactive setup experience

set -e

echo "🚀 JWT Bearer Token Flow - Quick Setup"
echo "======================================"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

# Check OpenSSL
if ! command -v openssl &> /dev/null; then
    echo "❌ OpenSSL is not installed. Please install OpenSSL first."
    echo "   macOS: brew install openssl"
    echo "   Ubuntu/Debian: sudo apt-get install openssl"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Interactive prompts
echo "📋 Please provide the following information:"
echo ""

# Salesforce credentials
read -p "Salesforce Username: " SF_USERNAME
echo ""

echo "Choose authentication method:"
echo "1) Username + Password + Security Token"
echo "2) Access Token + Instance URL"
read -p "Select option (1 or 2): " AUTH_METHOD
echo ""

if [ "$AUTH_METHOD" = "1" ]; then
    read -s -p "Password + Security Token: " SF_PASSWORD
    echo ""
    echo ""
    
    read -p "Login URL (press Enter for login.salesforce.com): " SF_LOGIN_URL
    if [ -z "$SF_LOGIN_URL" ]; then
        SF_LOGIN_URL="https://login.salesforce.com"
    fi
    
elif [ "$AUTH_METHOD" = "2" ]; then
    read -s -p "Access Token: " SF_ACCESS_TOKEN
    echo ""
    echo ""
    
    read -p "Instance URL (e.g., https://yourcompany.salesforce.com): " SF_INSTANCE_URL
    echo ""
    
else
    echo "❌ Invalid option selected"
    exit 1
fi

# Optional settings
read -p "Contact Email (for Connected App): " CONTACT_EMAIL
echo ""

read -p "Organization Name (for certificate): " ORGANIZATION
if [ -z "$ORGANIZATION" ]; then
    ORGANIZATION="Lambda Integration"
fi
echo ""

read -p "Connected App Name (press Enter for JWT_Lambda_Integration): " APP_NAME
if [ -z "$APP_NAME" ]; then
    APP_NAME="JWT_Lambda_Integration"
fi
echo ""

read -p "Output Directory (press Enter for ./jwt-output): " OUTPUT_DIR
if [ -z "$OUTPUT_DIR" ]; then
    OUTPUT_DIR="./jwt-output"
fi
echo ""

# Confirm settings
echo "🔍 Configuration Summary:"
echo "========================"
echo "Username: $SF_USERNAME"
if [ "$AUTH_METHOD" = "1" ]; then
    echo "Auth Method: Username/Password"
    echo "Login URL: $SF_LOGIN_URL"
else
    echo "Auth Method: Access Token"
    echo "Instance URL: $SF_INSTANCE_URL"
fi
echo "Contact Email: $CONTACT_EMAIL"
echo "Organization: $ORGANIZATION"
echo "App Name: $APP_NAME"
echo "Output Directory: $OUTPUT_DIR"
echo ""

read -p "Proceed with setup? (y/N): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Setup cancelled."
    exit 0
fi

echo ""
echo "🚀 Starting automated setup..."
echo ""

# Build command
CMD="node setup-jwt-flow.js"
CMD="$CMD --username \"$SF_USERNAME\""

if [ "$AUTH_METHOD" = "1" ]; then
    CMD="$CMD --password \"$SF_PASSWORD\""
    CMD="$CMD --login-url \"$SF_LOGIN_URL\""
else
    CMD="$CMD --access-token \"$SF_ACCESS_TOKEN\""
    CMD="$CMD --instance-url \"$SF_INSTANCE_URL\""
fi

if [ ! -z "$CONTACT_EMAIL" ]; then
    CMD="$CMD --contact-email \"$CONTACT_EMAIL\""
fi

CMD="$CMD --organization \"$ORGANIZATION\""
CMD="$CMD --app-name \"$APP_NAME\""
CMD="$CMD --output-dir \"$OUTPUT_DIR\""

# Run the setup
eval $CMD

# Check if setup was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Setup completed successfully!"
    echo ""
    echo "📁 Generated files:"
    echo "   - $OUTPUT_DIR/.env.jwt (environment variables)"
    echo "   - $OUTPUT_DIR/jwt-config.json (configuration)"
    echo "   - $OUTPUT_DIR/private_key.pem (private key)"
    echo "   - $OUTPUT_DIR/public.crt (certificate)"
    echo ""
    echo "🔐 IMPORTANT SECURITY NOTES:"
    echo "   - Keep your private key secure and never commit it to version control"
    echo "   - For production, store the private key in AWS Secrets Manager"
    echo "   - The Connected App may take 2-10 minutes to fully activate"
    echo ""
    echo "📋 Next Steps:"
    echo "   1. Test the setup: npm run test"
    echo "   2. Copy environment variables to your Lambda function"
    echo "   3. Deploy and test your Lambda integration"
    echo ""
    
    # Ask if user wants to run test
    read -p "Run test now to verify setup? (y/N): " RUN_TEST
    if [ "$RUN_TEST" = "y" ] || [ "$RUN_TEST" = "Y" ]; then
        echo ""
        echo "🧪 Running setup test..."
        node test-setup.js
    fi
    
else
    echo ""
    echo "❌ Setup failed. Please check the error messages above."
    echo ""
    echo "💡 Common solutions:"
    echo "   - Ensure you have System Administrator privileges"
    echo "   - Verify your credentials are correct"
    echo "   - Check that Metadata API is enabled in your org"
    echo "   - Try again in a few minutes if there were network issues"
    exit 1
fi