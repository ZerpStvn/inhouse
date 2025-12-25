import { customAlphabet } from 'nanoid';

// Create a custom alphabet without ambiguous characters (0, O, I, l, 1)
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Generate a 6-character code
const generateCode = customAlphabet(alphabet, 6);

export function generateAccessCode(): string {
  return generateCode();
}

export function formatCode(code: string): string {
  // Format as XXX-XXX for display
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

export function normalizeCode(code: string): string {
  // Remove dashes and convert to uppercase
  return code.replace(/-/g, '').toUpperCase();
}
