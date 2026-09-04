// system-monitor mock 1.0.0 — ESM puro, sin imports remotos.
// El Agent lo ejecuta en su sandbox y reporta el resultado vía POST /api/v1/results.
// Contrato: export default { async run(params, ctx) -> JSON-serializable }.

const now = () => new Date().toISOString();

async function sample(params = {}) {
  const seed = (params.seed ?? Date.now() % 1000) / 1000;
  const cpu = Math.round((15 + 60 * Math.abs(Math.sin(seed * 12.7))) * 10) / 10;
  const mem = Math.round((35 + 30 * Math.abs(Math.cos(seed * 7.3))) * 10) / 10;
  return { cpuPercent: cpu, memPercent: mem, at: now() };
}

export default {
  id: 'system-monitor',
  version: '1.0.0',
  async run(params = {}, ctx = {}) {
    const intervalSec = Number(params.intervalSec ?? 60);
    const reading = await sample(params);
    if (params.notifyOnHighCpu && reading.cpuPercent > 85 && ctx.notify) {
      await ctx.notify('System Monitor', `CPU alta: ${reading.cpuPercent}%`);
    }
    return { ok: true, intervalSec, reading, reportedAt: now() };
  },
};
