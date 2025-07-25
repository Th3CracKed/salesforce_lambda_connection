/**
 * Utility functions for handling private keys and certificates
 */

/**
 * Format private key from environment variable
 * Handles common formatting issues with private keys in env vars
 */
export function formatPrivateKey(privateKey: string): string {
  if (!privateKey) {
    throw new Error('Private key is required');
  }

  // Replace literal \n with actual newlines
  let formattedKey = privateKey.replace(/\\n/g, '\n');

  // Ensure proper PEM format
  if (!formattedKey.includes('-----BEGIN')) {
    formattedKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`;
  }

  // Ensure proper line breaks
  formattedKey = formattedKey
    .replace(/-----BEGIN PRIVATE KEY-----\s*/, '-----BEGIN PRIVATE KEY-----\n')
    .replace(/\s*-----END PRIVATE KEY-----/, '\n-----END PRIVATE KEY-----')
    .replace(/\n\n+/g, '\n'); // Remove multiple newlines

  return formattedKey;
}

/**
 * Validate private key format
 */
export function validatePrivateKey(privateKey: string): boolean {
  try {
    const formatted = formatPrivateKey(privateKey);
    return formatted.includes('-----BEGIN PRIVATE KEY-----') && 
           formatted.includes('-----END PRIVATE KEY-----');
  } catch {
    return false;
  }
}

/**
 * Extract key content without headers
 */
export function extractKeyContent(privateKey: string): string {
  return privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '')
    .trim();
}