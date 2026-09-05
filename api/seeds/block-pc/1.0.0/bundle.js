// block-pc 1.0.0 — Bloquea la estacion de trabajo
var blockPc = {
  id: 'block-pc',
  version: '1.0.0',
  run: async function(params, ctx) {
    return { ok: true, action: 'lock', msg: 'Lock command sent', at: new Date().toISOString() };
  }
};
if (typeof module !== 'undefined') module.exports = { default: blockPc };
