var shutdownPc = { id: 'shutdown-pc', version: '1.0.0', run: async function(params, ctx) {
  try {
    var delay = Number(params.delaySec || 0);
    if (ctx.system && ctx.system.shutdown) { await ctx.system.shutdown(delay); return { ok: true, action: 'shutdown', delaySec: delay, at: new Date().toISOString() }; }
    if (ctx.exec) { await ctx.exec('shutdown /s /t ' + delay + ' /f'); return { ok: true, action: 'shutdown', delaySec: delay, at: new Date().toISOString() }; }
    return { ok: false, error: 'No hay funcion de sistema disponible. Necesita ctx.system.shutdown() o ctx.exec()', at: new Date().toISOString() };
  } catch (e) { return { ok: false, error: e.message, at: new Date().toISOString() }; }
} };
