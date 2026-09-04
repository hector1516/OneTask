import Ajv, { JSONSchemaType } from 'ajv';

export interface Manifest {
  id: string;
  name: string;
  version: string;
  description: string;
  entry: string;
  minCoreVersion: string;
  permissions: string[];
  hash: string;
  signature: string;
  configSchema: Record<string, unknown>;
}

const schema: JSONSchemaType<Omit<Manifest, 'signature'> & { signature?: string }> = {
  type: 'object',
  required: ['id', 'name', 'version', 'description', 'entry', 'minCoreVersion', 'permissions', 'hash', 'configSchema'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 128 },
    name: { type: 'string', minLength: 1, maxLength: 255 },
    version: { type: 'string', minLength: 1, maxLength: 32 },
    description: { type: 'string', maxLength: 5000 },
    entry: { type: 'string', minLength: 1, maxLength: 255 },
    minCoreVersion: { type: 'string', minLength: 1, maxLength: 32 },
    permissions: { type: 'array', items: { type: 'string' } },
    hash: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' },
    signature: { type: 'string', nullable: true },
    configSchema: { type: 'object' },
  },
  additionalProperties: true,
};

const ajv = new Ajv({ allErrors: true });
export const validateManifest = ajv.compile(schema);
