// restart-pc 1.0.0 — Reinicia la maquina de Windows.

const now = () => new Date().toISOString();

export default {
  id: 'restart-pc',
  version: '1.0.0',
  async run(params = {}, ctx = {}) {
    try {
      const delay = Number(params.delaySec ?? 0);
      if (params.notify !== false && ctx.notify) {
        await ctx.notify('Restart PC', `Reiniciando en ${delay}s...`);
      }
      const { execSync } = require('child_process');
      execSync(`shutdown /r /t ${delay} /f`, { timeout: 5000 });
      return { ok: true, action: 'restart', delaySec: delay, executedAt: now() };
    } catch (err) {
      return { ok: false, error: err.message, executedAt: now() };
    }
  },
};
