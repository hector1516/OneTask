import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pool } from './db';
import { validateManifest, Manifest } from './manifestSchema';
import { PERMISSION_WHITELIST, bundleHash, loadSigningKeys, publicKeyBase64, signManifest, verifyManifest } from './signer';

export const STORAGE_ROOT = process.env.MODULES_STORAGE ?? path.join(process.cwd(), 'storage', 'modules');
export const SEEDS_ROOT = path.join(process.cwd(), 'seeds');

export interface PublishInput {
  id: string;
  name: string;
  version: string;
  description?: string;
  entry?: string;
  minCoreVersion?: string;
  permissions?: string[];
  configSchema?: Record<string, unknown>;
  bundleCode: string;
}

function assertPermissions(perms: string[]): void {
  const bad = perms.filter((p) => !(PERMISSION_WHITELIST as readonly string[]).includes(p));
  if (bad.length > 0) throw Object.assign(new Error(`permissions no whitelisteadas: ${bad.join(', ')}`), { status: 400 });
}

function moduleDir(id: string, version: string): string {
  return path.join(STORAGE_ROOT, id, version);
}

/** Genera bundle: calcula hash, firma manifest (Ed25519), persiste en storage + MySQL. */
export async function publishModule(input: PublishInput): Promise<Manifest> {
  const { privateKey, publicKey } = loadSigningKeys();
  const permissions = input.permissions ?? [];
  assertPermissions(permissions);
  const entry = input.entry ?? 'bundle.js';
  const unsigned = {
    id: input.id,
    name: input.name,
    version: input.version,
    description: input.description ?? '',
    entry,
    minCoreVersion: input.minCoreVersion ?? '0.1.0',
    permissions,
    hash: bundleHash(input.bundleCode),
    configSchema: input.configSchema ?? { type: 'object', properties: {} },
  };
  if (!validateManifest(unsigned)) {
    throw Object.assign(new Error(`manifest inválido: ${JSON.stringify(validateManifest.errors)}`), { status: 400 });
  }
  const signature = signManifest(unsigned, privateKey);
  const manifest: Manifest = { ...unsigned, signature };
  if (!verifyManifest(unsigned, signature, publicKey)) throw new Error('fallo de firma (interno)');

  const dir = moduleDir(input.id, input.version);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, entry), input.bundleCode, 'utf8');
  await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  await pool.query(
    `INSERT INTO modules (id, version, name, description, entry, min_core_version, permissions, config_schema, hash, signature)
     VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?)
     ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), entry=VALUES(entry),
       min_core_version=VALUES(min_core_version), permissions=VALUES(permissions),
       config_schema=VALUES(config_schema), hash=VALUES(hash), signature=VALUES(signature)`,
    [
      manifest.id, manifest.version, manifest.name, manifest.description, manifest.entry,
      manifest.minCoreVersion, JSON.stringify(manifest.permissions),
      JSON.stringify(manifest.configSchema), manifest.hash, manifest.signature,
    ],
  );
  return manifest;
}

export function bundleUrlFor(id: string, version: string): string {
  return `/api/v1/modules/${encodeURIComponent(id)}/${encodeURIComponent(version)}/bundle.js`;
}

export async function listModules(): Promise<Array<{ manifest: Manifest; bundleUrl: string; signature: string; hash: string }>> {
  const [rows] = await pool.query(
    'SELECT id, version, name, description, entry, min_core_version, permissions, config_schema, hash, signature FROM modules ORDER BY id, version',
  );
  return (rows as Array<Record<string, unknown>>).map((r) => {
    const manifest: Manifest = {
      id: r.id as string,
      name: r.name as string,
      version: r.version as string,
      description: (r.description as string) ?? '',
      entry: (r.entry as string) ?? 'bundle.js',
      minCoreVersion: (r.min_core_version as string) ?? '0.1.0',
      permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions as string) : (r.permissions as string[]),
      hash: r.hash as string,
      signature: r.signature as string,
      configSchema:
        typeof r.config_schema === 'string' ? JSON.parse(r.config_schema as string) : ((r.config_schema as object) ?? {}),
    };
    return { manifest, bundleUrl: bundleUrlFor(manifest.id, manifest.version), signature: manifest.signature, hash: manifest.hash };
  });
}

export async function readBundle(id: string, version: string): Promise<{ manifest: Manifest; code: string }> {
  const dir = moduleDir(id, version);
  const [manifestRaw, code] = await Promise.all([
    fs.readFile(path.join(dir, 'manifest.json'), 'utf8'),
    fs.readFile(path.join(dir, (await manifestEntry(dir)) ?? 'bundle.js'), 'utf8'),
  ]);
  return { manifest: JSON.parse(manifestRaw) as Manifest, code };
}

async function manifestEntry(dir: string): Promise<string | null> {
  try {
    const m = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8')) as { entry?: string };
    return m.entry ?? null;
  } catch {
    return null;
  }
}

/** (Re)genera seeds de api/seeds/<id>/<version>/{meta.json,bundle.js} si cambian. */
export async function seedModules(): Promise<Manifest[]> {
  const out: Manifest[] = [];
  let ids: string[] = [];
  try {
    ids = await fs.readdir(SEEDS_ROOT);
  } catch {
    return out;
  }
  for (const id of ids) {
    let versions: string[] = [];
    try {
      versions = await fs.readdir(path.join(SEEDS_ROOT, id));
    } catch {
      continue;
    }
    for (const version of versions) {
      const base = path.join(SEEDS_ROOT, id, version);
      try {
        const [metaRaw, code] = await Promise.all([
          fs.readFile(path.join(base, 'meta.json'), 'utf8'),
          fs.readFile(path.join(base, 'bundle.js'), 'utf8'),
        ]);
        const meta = JSON.parse(metaRaw) as Omit<PublishInput, 'bundleCode' | 'id' | 'version'>;
        const m = await publishModule({ ...meta, id, version, bundleCode: code });
        out.push(m);
        console.log(`[modules] seed ${id}@${version} hash=${m.hash.slice(0, 19)}…`);
      } catch (err) {
        console.warn(`[modules] seed omitido ${id}@${version}: ${(err as Error).message}`);
      }
    }
  }
  return out;
}

export function getPublicKeyB64(): string {
  return publicKeyBase64(loadSigningKeys().publicKey);
}
