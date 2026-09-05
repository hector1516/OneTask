var blockPc = { id: 'block-pc', version: '1.0.0', run: async function(params, ctx) {
  try {
    if (ctx.system && ctx.system.lock) { await ctx.system.lock(); return { ok: true, action: 'lock', at: new Date().toISOString() }; }
    if (ctx.exec) { await ctx.exec('rundll32.exe user32.dll,LockWorkStation'); return { ok: true, action: 'lock', at: new Date().toISOString() }; }
    return { ok: false, error: 'No hay funcion de sistema disponible en el Agent. Necesita ctx.system.lock() o ctx.exec()', at: new Date().toISOString() };
  } catch (e) { return { ok: false, error: e.message, at: new Date().toISOString() }; }
} };
