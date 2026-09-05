// block-pc 1.0.0 — Bloquea la estacion de trabajo de Windows.
// Core SDK: ctx.system.lock()

const now = () => new Date().toISOString();

export default {
  id: 'block-pc',
  version: '1.0.0',
  async run(params = {}, ctx = {}) {
    try {
      if (ctx.system?.lock) {
        await ctx.system.lock();
      } else if (ctx.exec) {
        await ctx.exec('rundll32.exe user32.dll,LockWorkStation');
      } else {
        return { ok: false, error: 'system.lock not available in Core SDK', executedAt: now() };
      }
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
