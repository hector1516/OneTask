// shutdown-pc 1.0.0 — Apaga la maquina
var shutdownPc = {
  id: 'shutdown-pc',
  version: '1.0.0',
  run: async function(params, ctx) {
    var delay = Number(params.delaySec || 0);
    return { ok: true, action: 'shutdown', delaySec: delay, at: new Date().toISOString() };
  }
};
if (typeof module !== 'undefined') module.exports = { default: shutdownPc };
