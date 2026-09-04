import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { createHash } from 'node:crypto';

export const PERMISSION_WHITELIST = [
  'system.read',
  'fs.read',
  'net.fetch',
  'clipboard.read',
  'overlay.show',
  'tray.notify',
] as const;

/** Canonical JSON: sorted keys, no whitespace — what gets signed. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`;
}

export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function bundleHash(bundleCode: string | Buffer): string {
  return `sha256:${sha256Hex(bundleCode)}`;
}

type KeyPair = { privateKey: ReturnType<typeof createPrivateKey>; publicKey: ReturnType<typeof createPublicKey> };

function fromSeed32(seed: Buffer): KeyPair {
  // Build PKCS8 DER for Ed25519 seed (RFC 8410 prefix + 32-byte seed).
  const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const der = Buffer.concat([prefix, seed]);
  const privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  const publicKey = createPublicKey(privateKey);
  return { privateKey, publicKey };
}

/** Accepts: file path (starts with / or ./ or contains :), base64/hex 32-byte seed, base64 PKCS8 DER, or 'generate' (ephemeral dev). */
export function loadSigningKeys(): KeyPair & { ephemeral: boolean } {
  let raw = (process.env.MODULE_SIGNING_PRIVATE_KEY ?? '').trim();
  if (!raw || raw === 'generate') {
    if (!raw) console.warn('[signer] MODULE_SIGNING_PRIVATE_KEY vacío: usando clave efímera (solo dev).');
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    return { privateKey, publicKey, ephemeral: true };
  }
  // If it looks like a file path, read the key from file
  if (/^[\\/]|^[A-Z]:|^\./.test(raw)) {
    try {
      const keyData = require('node:fs').readFileSync(raw, 'utf8').trim();
      raw = keyData;
      console.log(`[signer] clave leída de archivo: ${process.env.MODULE_SIGNING_PRIVATE_KEY}`);
    } catch (err) {
      console.error(`[signer] no se pudo leer archivo de clave: ${raw}`, (err as Error).message);
    }
  }
  // Try base64 DER PKCS8
  try {
    const der = Buffer.from(raw.replace(/\s+/g, ''), 'base64');
    if (der.length > 40) {
      const privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
      return { privateKey, publicKey: createPublicKey(privateKey), ephemeral: false };
    }
  } catch {
    /* fall through */
  }
  // Try hex / base64 32-byte seed
  const seedHex = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : null;
  const seedB64 = (() => {
    try {
      const b = Buffer.from(raw, 'base64');
      return b.length === 32 ? b : null;
    } catch {
      return null;
    }
  })();
  const seed = seedHex ?? seedB64;
  if (seed) return { ...fromSeed32(seed), ephemeral: false };
  throw new Error('MODULE_SIGNING_PRIVATE_KEY con formato no reconocido (usa archivo, base64 PKCS8 DER, o seed de 32 bytes).');
}

export function publicKeyBase64(publicKey: ReturnType<typeof createPublicKey>): string {
  return publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
}

export function signManifest(unsignedManifest: Record<string, unknown>, privateKey: ReturnType<typeof createPrivateKey>): string {
  const payload = Buffer.from(canonicalize(unsignedManifest), 'utf8');
  return sign(null, payload, privateKey).toString('base64');
}

export function verifyManifest(
  unsignedManifest: Record<string, unknown>,
  signatureB64: string,
  publicKey: ReturnType<typeof createPublicKey>,
): boolean {
  try {
    return verify(null, Buffer.from(canonicalize(unsignedManifest), 'utf8'), publicKey, Buffer.from(signatureB64, 'base64'));
  } catch {
    return false;
  }
}
