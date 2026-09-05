// restart-pc 1.0.0 — Reinicia la maquina
var restartPc = {
  id: 'restart-pc',
  version: '1.0.0',
  run: async function(params, ctx) {
    var delay = Number(params.delaySec || 0);
    return { ok: true, action: 'restart', delaySec: delay, at: new Date().toISOString() };
  }
};
if (typeof module !== 'undefined') module.exports = { default: restartPc };
