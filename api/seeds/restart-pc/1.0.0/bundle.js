// restart-pc 1.0.0 — Reinicia la maquina de Windows.
// Core SDK: ctx.system.restart()

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
      if (ctx.system?.restart) {
        await ctx.system.restart(delay);
      } else if (ctx.exec) {
        await ctx.exec(`shutdown /r /t ${delay} /f`);
      } else {
        return { ok: false, error: 'system.restart not available in Core SDK', executedAt: now() };
      }
      return { ok: true, action: 'restart', delaySec: delay, executedAt: now() };
    } catch (err) {
      return { ok: false, error: err.message, executedAt: now() };
    }
  },
};
