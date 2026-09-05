var systemMonitor = { id: 'system-monitor', version: '1.0.0', run: async function(params, ctx) {
  try {
    var result = { at: new Date().toISOString() };
    if (ctx.exec) {
      var cpuRaw = await ctx.exec('wmic cpu get loadpercentage /value');
      var memRaw = await ctx.exec('wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /value');
      var cpuMatch = cpuRaw.match(/LoadPercentage=(\d+)/);
      var memMatch = memRaw.match(/FreePhysicalMemory=(\d+)/);
      var totalMatch = memRaw.match(/TotalVisibleMemorySize=(\d+)/);
      result.cpuPercent = cpuMatch ? Number(cpuMatch[1]) : null;
      if (memMatch && totalMatch) { var free = Number(memMatch[1]); var total = Number(totalMatch[1]); result.memPercent = Math.round(((total - free) / total) * 100); }
    }
    result.ok = true;
    return result;
  } catch (e) { return { ok: false, error: e.message, at: new Date().toISOString() }; }
} };
