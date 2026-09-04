import { Router, Request, Response } from 'express';
import { login, refresh } from './auth';
import { AuthedRequest, deviceIdOf, requireAuth } from './middleware';
import { bundleUrlFor, getPublicKeyB64, listModules, publishModule, readBundle, STORAGE_ROOT } from './modules';
import { onlineThresholdSec, pool } from './db';

export const router = Router();

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      const status = (err as { status?: number }).status ?? 500;
      res.status(status).json({ error: (err as Error).message });
    });
  };
}

// ---------- auth (acepta /auth/* y /api/v1/auth/*) ----------
async function handleLogin(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ error: 'username y password requeridos' });
    return;
  }
  res.json(await login(String(username), String(password)));
}

async function handleRefresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken) {
    res.status(400).json({ error: 'refreshToken requerido' });
    return;
  }
  res.json(await refresh(String(refreshToken)));
}

router.post(['/auth/login', '/api/v1/auth/login'], asyncHandler(handleLogin));
router.post(['/auth/refresh', '/api/v1/auth/refresh'], asyncHandler(handleRefresh));

// ---------- públicas ----------
router.get('/health', (_req, res) => res.json({ ok: true, service: 'onetask-api', version: '0.1.0' }));
router.get(['/api/v1/public-key', '/public-key'], (_req, res) => {
  res.json({ algorithm: 'Ed25519', publicKey: getPublicKeyB64() });
});

// ---------- helpers queue/devices ----------
async function ensureDevice(id: string, name?: string): Promise<void> {
  if (!id) return;
  await pool.query('INSERT IGNORE INTO devices (id, name) VALUES (?, ?)', [id, name ?? id]);
  await pool.query('UPDATE devices SET last_heartbeat = NOW() WHERE id = ?', [id]);
}

async function queueSummary(deviceId: string): Promise<{ total: number; pending: number; running: number; done: number }> {
  const [rows] = await pool.query(
    `SELECT COUNT(*) total,
       SUM(status='pending') pending, SUM(status='running') running, SUM(status='done') done
     FROM module_queue WHERE deviceId = ?`,
    [deviceId],
  );
  const r = (rows as Array<Record<string, number | null>>)[0] ?? {};
  return {
    total: Number(r.total ?? 0),
    pending: Number(r.pending ?? 0),
    running: Number(r.running ?? 0),
    done: Number(r.done ?? 0),
  };
}

function toIso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  return v == null ? null : String(v);
}

// ---------- Agent pull: módulos ----------
router.get(
  '/api/v1/me/modules',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const deviceId = deviceIdOf(req);
    if (deviceId) await ensureDevice(deviceId);
    const minCore = typeof req.query.minCoreVersion === 'string' ? req.query.minCoreVersion : undefined;
    const all = await listModules();
    // Filtro por minCoreVersion del core del Agent (semver laxa: prefijo numérico).
    const filtered = minCore
      ? all.filter((m) => compareCore(m.manifest.minCoreVersion, minCore) <= 0)
      : all;
    res.json(filtered);
  }),
);

function coreParts(v: string): number[] {
  return v.split('.').map((x) => parseInt(x, 10) || 0);
}
function compareCore(a: string, b: string): number {
  const pa = coreParts(a);
  const pb = coreParts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// ---------- Agent pull: cola (DEC-007) ----------
router.get(
  '/api/v1/me/queue',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const deviceId = deviceIdOf(req);
    if (!deviceId) {
      res.status(400).json({ error: 'deviceId requerido (?deviceId= o X-Device-Id)' });
      return;
    }
    await ensureDevice(deviceId);
    const [rows] = await pool.query(
      `SELECT q.id, q.moduleId, COALESCE(m.name, q.moduleId) moduleName,
              COALESCE(m.description, '') moduleDescription, q.version, q.params, q.priority, q.status,
              q.queuedAt, q.startedAt, q.finishedAt
         FROM module_queue q LEFT JOIN modules m
           ON m.id = q.moduleId AND (m.version = q.version OR q.version = 'latest')
        WHERE q.deviceId = ? AND q.status IN ('pending','running')
        ORDER BY q.priority DESC, q.queuedAt ASC LIMIT 100`,
      [deviceId],
    );
    const queue = (rows as Array<Record<string, unknown>>).map((r) => ({
      id: r.id,
      moduleId: r.moduleId,
      moduleName: r.moduleName,
      moduleDescription: r.moduleDescription,
      version: r.version,
      params: typeof r.params === 'string' ? JSON.parse(r.params as string) : r.params,
      priority: r.priority,
      status: r.status,
      queuedAt: toIso(r.queuedAt),
      startedAt: toIso(r.startedAt),
      finishedAt: toIso(r.finishedAt),
    }));
    const s = await queueSummary(deviceId);
    res.json({ queue, ...s });
  }),
);

// ---------- Admin: encolar (funciona incluso offline, DEC-007) ----------
router.post(
  '/api/v1/devices/:id/queue',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const deviceId = (req.params.id ?? '').trim();
    const { moduleId, version, params, priority } = req.body ?? {};
    if (!deviceId || !moduleId) {
      res.status(400).json({ error: 'deviceId y moduleId requeridos' });
      return;
    }
    await ensureDevice(deviceId);
    const [r] = await pool.query(
      `INSERT INTO module_queue (deviceId, moduleId, version, params, priority, status)
       VALUES (?, ?, ?, CAST(? AS JSON), ?, 'pending')`,
      [deviceId, String(moduleId), String(version ?? 'latest'), JSON.stringify(params ?? {}), Number(priority ?? 0)],
    );
    const insertId = (r as { insertId: number }).insertId;
    const [rows] = await pool.query(
      `SELECT id, moduleId, version, params, priority, status, queuedAt, startedAt, finishedAt
         FROM module_queue WHERE id = ?`,
      [insertId],
    );
    res.status(201).json((rows as unknown[])[0]);
  }),
);

// Cancelar TODAS las misiones pending|running de un device
router.delete(
  '/api/v1/devices/:id/queue',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const deviceId = (req.params.id ?? '').trim();
    if (!deviceId) {
      res.status(400).json({ error: 'deviceId requerido' });
      return;
    }
    const [result] = await pool.query(
      `UPDATE module_queue SET status = 'failed', finishedAt = NOW()
        WHERE deviceId = ? AND status IN ('pending','running')`,
      [deviceId],
    );
    const cancelled = (result as { affectedRows: number }).affectedRows;
    res.json({ ok: true, cancelled });
  }),
);
router.delete(
  '/api/v1/devices/:id/queue/:itemId',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const deviceId = (req.params.id ?? '').trim();
    const itemId = Number(req.params.itemId);
    if (!deviceId || !itemId) {
      res.status(400).json({ error: 'deviceId y itemId requeridos' });
      return;
    }
    const [result] = await pool.query(
      `UPDATE module_queue SET status = 'failed', finishedAt = NOW()
        WHERE id = ? AND deviceId = ? AND status IN ('pending','running')`,
      [itemId, deviceId],
    );
    const affected = (result as { affectedRows: number }).affectedRows;
    if (affected === 0) {
      res.status(404).json({ error: 'misión no encontrada o ya finalizada' });
      return;
    }
    res.json({ ok: true, cancelled: itemId });
  }),
);

// Admin: ver Buffer completa + resultados
router.get(
  '/api/v1/devices/:id/queue',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const deviceId = (req.params.id ?? '').trim();
    const [rows] = await pool.query(
      `SELECT q.id, q.moduleId, COALESCE(m.name, q.moduleId) moduleName,
              COALESCE(m.description, '') moduleDescription, q.version, q.params, q.priority, q.status,
              q.queuedAt, q.startedAt, q.finishedAt
         FROM module_queue q LEFT JOIN modules m ON m.id = q.moduleId AND m.version = q.version
        WHERE q.deviceId = ? ORDER BY q.queuedAt DESC LIMIT 200`,
      [deviceId],
    );
    res.json({ queue: rows, ...(await queueSummary(deviceId)) });
  }),
);

router.get(
  '/api/v1/devices/:id/results',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const deviceId = (req.params.id ?? '').trim();
    const [rows] = await pool.query(
      `SELECT device_id deviceId, module_id moduleId, module_name moduleName,
              module_description moduleDescription, module_version version,
              queue_total total, queue_pending pending, queue_running running, queue_done done,
              exec_status status, exec_queued_at queuedAt, exec_started_at startedAt,
              exec_finished_at finishedAt, reported_at reportedAt, created_at createdAt, raw
         FROM module_results WHERE device_id = ? ORDER BY created_at DESC LIMIT 100`,
      [deviceId],
    );
    res.json({ results: rows });
  }),
);

// ---------- Agent push: resultados (DEC-007) ----------
// POST /api/v1/results {deviceId, module:{id,name,description,version},
//   queue:{total,pending,running,done}, execution:{status,queuedAt,startedAt,finishedAt}, reportedAt}
router.post(
  '/api/v1/results',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { deviceId, module, queue, execution, reportedAt } = req.body ?? {};
    if (!deviceId) {
      res.status(400).json({ error: 'deviceId requerido' });
      return;
    }
    await ensureDevice(String(deviceId), typeof module?.name === 'string' ? undefined : undefined);
    const toDate = (v: unknown): string | null => {
      if (!v) return null;
      const d = new Date(String(v));
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
    };
    await pool.query(
      `INSERT INTO module_results
        (device_id, module_id, module_name, module_description, module_version,
         queue_total, queue_pending, queue_running, queue_done,
         exec_status, exec_queued_at, exec_started_at, exec_finished_at, reported_at, raw)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))`,
      [
        String(deviceId),
        String(module?.id ?? ''),
        String(module?.name ?? ''),
        String(module?.description ?? ''),
        String(module?.version ?? ''),
        Number(queue?.total ?? 0),
        Number(queue?.pending ?? 0),
        Number(queue?.running ?? 0),
        Number(queue?.done ?? 0),
        String(execution?.status ?? ''),
        toDate(execution?.queuedAt),
        toDate(execution?.startedAt),
        toDate(execution?.finishedAt),
        toDate(reportedAt),
        JSON.stringify(req.body),
      ],
    );
    // Marca best-effort: si el Agent reporta done/failed con startedAt coincidente, cierra pendientes.
    try {
      const st = String(execution?.status ?? '');
      if (['done', 'failed'].includes(st) && module?.id) {
        await pool.query(
          `UPDATE module_queue SET status = ?, finishedAt = NOW()
            WHERE deviceId = ? AND moduleId = ? AND status IN ('pending','running')`,
          [st, String(deviceId), String(module.id)],
        );
      }
    } catch {
      /* best-effort */
    }
    res.status(201).json({ ok: true });
  }),
);

// ---------- devices + heartbeat ----------
router.get(
  '/api/v1/devices',
  requireAuth,
  asyncHandler(async (_req: AuthedRequest, res: Response) => {
    const threshold = onlineThresholdSec();
    const [rows] = await pool.query(
      `SELECT d.id deviceId, d.id id, d.name,
              d.last_heartbeat lastHeartbeat,
              (d.last_heartbeat > DATE_SUB(NOW(), INTERVAL ? SECOND)) online,
              (SELECT COUNT(*) FROM module_queue q WHERE q.deviceId = d.id AND q.status='pending') pending,
              (SELECT COUNT(*) FROM module_queue q WHERE q.deviceId = d.id AND q.status='running') running
         FROM devices d ORDER BY d.last_heartbeat DESC`,
      [threshold],
    );
    res.json({
      devices: (rows as Array<Record<string, unknown>>).map((r) => ({
        ...r,
        online: Number(r.online ?? 0) === 1,
        lastHeartbeat: toIso(r.lastHeartbeat),
      })),
      onlineThresholdSec: threshold,
    });
  }),
);

// Renombrar device desde Admin (tabla de equivalencias configurable)
router.put(
  '/api/v1/devices/:id',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const deviceId = (req.params.id ?? '').trim();
    const { name } = req.body ?? {};
    if (!deviceId || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'deviceId y name requeridos' });
      return;
    }
    await pool.query('UPDATE devices SET name = ? WHERE id = ?', [name.trim(), deviceId]);
    res.json({ ok: true, deviceId, name: name.trim() });
  }),
);

router.get(
  '/api/v1/devices/:id/status',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const deviceId = (req.params.id ?? '').trim();
    const threshold = onlineThresholdSec();
    const [rows] = await pool.query(
      `SELECT id deviceId, name, last_heartbeat lastHeartbeat,
              (last_heartbeat > DATE_SUB(NOW(), INTERVAL ? SECOND)) online
         FROM devices WHERE id = ?`,
      [threshold, deviceId],
    );
    const dev = (rows as Array<Record<string, unknown>>)[0];
    if (!dev) {
      res.status(404).json({ error: 'device no encontrado' });
      return;
    }
    res.json({
      deviceId: dev.deviceId,
      name: dev.name,
      online: Number(dev.online ?? 0) === 1,
      lastHeartbeat: toIso(dev.lastHeartbeat),
      onlineThresholdSec: threshold,
      queue: await queueSummary(deviceId),
    });
  }),
);

// ---------- módulos: catálogo, publish (server genera) y bundle ----------
router.get('/api/v1/modules', requireAuth, asyncHandler(async (_req, res) => {
  res.json({ modules: await listModules() });
}));

router.post(
  '/api/v1/modules',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { id, name, version, description, entry, minCoreVersion, permissions, configSchema, bundleCode } = req.body ?? {};
    if (!id || !name || !version || !bundleCode) {
      res.status(400).json({ error: 'id, name, version y bundleCode requeridos' });
      return;
    }
    const manifest = await publishModule({
      id: String(id), name: String(name), version: String(version),
      description: description ? String(description) : '',
      entry: entry ? String(entry) : 'bundle.js',
      minCoreVersion: minCoreVersion ? String(minCoreVersion) : '0.1.0',
      permissions: Array.isArray(permissions) ? permissions.map(String) : [],
      configSchema: (configSchema as Record<string, unknown>) ?? {},
      bundleCode: String(bundleCode),
    });
    res.status(201).json({ manifest, bundleUrl: bundleUrlFor(manifest.id, manifest.version), signature: manifest.signature, hash: manifest.hash });
  }),
);

router.get(
  '/api/v1/modules/:id/:version/manifest.json',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { manifest } = await readBundle(req.params.id, req.params.version);
    res.json(manifest);
  }),
);

router.get(
  '/api/v1/modules/:id/:version/bundle.js',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { code } = await readBundle(req.params.id, req.params.version);
    res.type('text/javascript').send(code);
  }),
);

// Debug seguro: dónde vive el storage (sin listar claves)
router.get('/api/v1/_storage', requireAuth, (_req, res) => {
  res.json({ storageRoot: STORAGE_ROOT });
});
