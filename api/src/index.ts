import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { migrate, pool } from './db';
import { ensureSeedAdmin } from './auth';
import { router } from './routes';
import { seedModules } from './modules';

async function loadDeviceAliases(): Promise<void> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'seeds', 'device-names.json'), 'utf8');
    const map = JSON.parse(raw) as Record<string, string>;
    for (const [deviceId, name] of Object.entries(map)) {
      if (deviceId.startsWith('_')) continue;
      await pool.query('UPDATE devices SET name = ? WHERE id = ?', [name, deviceId]);
    }
    const count = Object.keys(map).filter((k) => !k.startsWith('_')).length;
    if (count > 0) console.log(`[boot] ${count} alias(es) de device aplicados desde device-names.json`);
  } catch {
    // archivo opcional
  }
}

async function main(): Promise<void> {
  await migrate();
  await ensureSeedAdmin();

  // Seed demo device (idempotente)
  const seedDeviceId = process.env.SEED_DEVICE_ID ?? 'agent-dev-01';
  const seedDeviceName = process.env.SEED_DEVICE_NAME ?? 'Dev Agent (Tauri)';
  await pool.query('INSERT IGNORE INTO devices (id, name) VALUES (?, ?)', [seedDeviceId, seedDeviceName]);

  // Genera bundles firmados desde api/seeds (system-monitor mock 1.0.0, ...)
  try {
    await seedModules();
  } catch (err) {
    console.warn('[boot] seedModules falló:', (err as Error).message);
  }

  // Aplica alias de nombre desde seeds/device-names.json
  await loadDeviceAliases();

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  const origins = (process.env.CORS_ORIGINS ?? 'https://api.onetask.internal,http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || origins.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS bloqueado para ${origin}`));
      },
    }),
  );

  app.use(router);
  // Alias legacy sin prefijo para el Agent (VITE_ONETASK_API_BASE_URL puede apuntar a / o /api/v1)
  app.use('/me', (req, res) => res.redirect(307, `/api/v1/me${req.url}`));

  const port = Number(process.env.API_PORT ?? process.env.PORT ?? '3000');
  app.listen(port, () => console.log(`[onetask-api] escuchando en :${port} (storage + MySQL listos)`));

  // Auto-limpieza: borra done/failed del buffer y resultados después de BUFFER_TTL_HOURS (def. 24h)
  const ttlHours = Number(process.env.BUFFER_TTL_HOURS ?? '24');
  const cleanup = async () => {
    try {
      const [q] = await pool.query(
        `DELETE FROM module_queue WHERE status IN ('done','failed') AND finishedAt < DATE_SUB(NOW(), INTERVAL ? HOUR)`,
        [ttlHours],
      );
      const [r] = await pool.query(
        `DELETE FROM module_results WHERE created_at < DATE_SUB(NOW(), INTERVAL ? HOUR)`,
        [ttlHours],
      );
      const qDel = (q as { affectedRows: number }).affectedRows;
      const rDel = (r as { affectedRows: number }).affectedRows;
      if (qDel > 0 || rDel > 0) console.log(`[cleanup] eliminados ${qDel} buffer + ${rDel} resultados (TTL ${ttlHours}h)`);
    } catch (err) {
      console.warn('[cleanup] error:', (err as Error).message);
    }
  };
  setInterval(cleanup, ttlHours * 3600_000);
  setTimeout(cleanup, 60_000);
}

main().catch((err) => {
  console.error('[onetask-api] boot fallido:', err);
  process.exit(1);
});
