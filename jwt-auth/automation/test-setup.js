#!/usr/bin/env node

/**
 * Test script to verify JWT Bearer Token Flow setup
 */

const fs = require('fs');
const path = require('path');
const { JWTConnectionManager } = require('../src/jwt-connection-manager');

async function testJWTSetup() {
  console.log('🧪 Testing JWT Bearer Token Flow setup...\n');

  try {
    // Check if config files exist
    const configPath = path.join(__dirname, 'jwt-output', 'jwt-config.json');
    const envPath = path.join(__dirname, 'jwt-output', '.env.jwt');

    if (!fs.existsSync(configPath)) {
      throw new Error('Configuration file not found. Run setup-jwt-flow.js first.');
    }

    // Load configuration
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('✅ Configuration loaded');
    console.log(`   Client ID: ${config.clientId}`);
    console.log(`   Username: ${config.username}`);
    console.log(`   Instance URL: ${config.instanceUrl}`);

    // Check private key file
    if (!fs.existsSync(config.privateKeyPath)) {
      throw new Error(`Private key file not found: ${config.privateKeyPath}`);
    }

    const privateKey = fs.readFileSync(config.privateKeyPath, 'utf8');
    console.log('✅ Private key loaded');

    // Test JWT connection
    console.log('\n🔐 Testing JWT connection...');
    const manager = JWTConnectionManager.getInstance();
    
    const jwtConfig = {
      clientId: config.clientId,
      privateKey: privateKey,
      username: config.username,
      instanceUrl: config.instanceUrl
    };

    const connection = await manager.getConnection(jwtConfig);
    console.log('✅ JWT connection established');

    // Test basic query
    console.log('\n📊 Testing Salesforce query...');
    const result = await connection.query('SELECT Id, Name FROM Organization LIMIT 1');
    
    if (result.records && result.records.length > 0) {
      console.log('✅ Query successful');
      console.log(`   Organization: ${result.records[0].Name}`);
    } else {
      console.log('⚠️  Query returned no results (this might be normal)');
    }

    // Test user info
    console.log('\n👤 Testing user identity...');
    const identity = await connection.identity();
    console.log('✅ Identity retrieved');
    console.log(`   User: ${identity.display_name}`);
    console.log(`   Username: ${identity.username}`);
    console.log(`   Organization: ${identity.organization_id}`);

    // Cache statistics
    const stats = manager.getCacheStats();
    console.log('\n📈 Cache statistics:');
    console.log(`   Total tokens: ${stats.total}`);
    console.log(`   Valid tokens: ${stats.valid}`);
    console.log(`   Expired tokens: ${stats.expired}`);

    console.log('\n🎉 All tests passed! JWT Bearer Token Flow is working correctly.');
    
    // Display next steps
    console.log('\n📋 Next Steps:');
    console.log('1. Copy environment variables from .env.jwt to your Lambda function');
    console.log('2. Store private key securely (AWS Secrets Manager recommended)');
    console.log('3. Deploy your Lambda function with JWT connection manager');
    console.log('4. Test end-to-end integration');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('JWT signature verification failed')) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('- Connected App may still be activating (wait 2-10 minutes)');
      console.log('- Verify certificate was uploaded correctly in Salesforce');
      console.log('- Check that private/public key pair matches');
    }
    
    if (error.message.includes('invalid_client_id')) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('- Verify Consumer Key in Connected App settings');
      console.log('- Ensure Connected App is saved and active');
    }
    
    if (error.message.includes('invalid_grant')) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('- Check username format and existence');
      console.log('- Verify user has access to the Connected App');
      console.log('- Ensure OAuth policies allow the user');
    }

    process.exit(1);
  }
}

// Run test
if (require.main === module) {
  testJWTSetup();
}

module.exports = { testJWTSetup };