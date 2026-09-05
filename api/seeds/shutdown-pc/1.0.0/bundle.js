// shutdown-pc 1.0.0 — Apaga la maquina de Windows.
// Core SDK: ctx.system.shutdown()

const now = () => new Date().toISOString();

export default {
  id: 'shutdown-pc',
  version: '1.0.0',
  async run(params = {}, ctx = {}) {
    try {
      const delay = Number(params.delaySec ?? 0);
      if (params.notify !== false && ctx.notify) {
        await ctx.notify('Shutdown PC', `Apagando en ${delay}s...`);
      }
      if (ctx.system?.shutdown) {
        await ctx.system.shutdown(delay);
      } else if (ctx.exec) {
        await ctx.exec(`shutdown /s /t ${delay} /f`);
      } else {
        return { ok: false, error: 'system.shutdown not available in Core SDK', executedAt: now() };
      }
      return { ok: true, action: 'shutdown', delaySec: delay, executedAt: now() };
    } catch (err) {
      return { ok: false, error: err.message, executedAt: now() };
    }
  },
};
