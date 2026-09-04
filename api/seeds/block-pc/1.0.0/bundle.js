// block-pc 1.0.0 — Bloquea la estacion de trabajo de Windows.

const now = () => new Date().toISOString();

export default {
  id: 'block-pc',
  version: '1.0.0',
  async run(params = {}, ctx = {}) {
    try {
      // Ejecuta LockWorkStation via PowerShell
      const { execSync } = require('child_process');
      execSync('rundll32.exe user32.dll,LockWorkStation', { timeout: 5000 });
      const result = { ok: true, action: 'lock', executedAt: now() };
      if (params.notify !== false && ctx.notify) {
        await ctx.notify('Block PC', 'Estacion de trabajo bloqueada.');
      }
      return result;
    } catch (err) {
      return { ok: false, error: err.message, executedAt: now() };
    }
  },
};
