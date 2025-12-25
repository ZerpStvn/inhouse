import crypto from 'crypto';

// Create a custom alphabet without ambiguous characters (0, O, I, l, 1)
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateAccessCode(): string {
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

export function formatCode(code: string): string {
  // Format as XXX-XXX for display
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

export function normalizeCode(code: string): string {
  // Remove dashes and convert to uppercase
  return code.replace(/-/g, '').toUpperCase();
}
