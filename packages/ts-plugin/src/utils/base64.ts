// Safely encode strings using Base64
export function encodeBase64(input: string) {
  return Buffer.from(input).toString('base64').replace(/=/g, '');
}

// Decode Base64 for retrieval
export function decodeBase64(input: string) {
  return Buffer.from(input, 'base64').toString('utf-8');
}
