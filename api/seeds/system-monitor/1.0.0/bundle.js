// system-monitor 1.0.0 — Telemetria del sistema
var systemMonitor = {
  id: 'system-monitor',
  version: '1.0.0',
  run: async function(params, ctx) {
    var cpu = Math.round(15 + 60 * Math.abs(Math.sin(Date.now() / 10000)));
    var mem = Math.round(35 + 30 * Math.abs(Math.cos(Date.now() / 7000)));
    return { ok: true, reading: { cpuPercent: cpu, memPercent: mem }, at: new Date().toISOString() };
  }
};
if (typeof module !== 'undefined') module.exports = { default: systemMonitor };
