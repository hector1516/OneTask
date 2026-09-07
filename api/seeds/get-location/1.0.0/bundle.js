var getLocation = { id: 'get-location', version: '1.0.0', run: async function(params, ctx) {
  if (typeof ctx.exec !== 'function') return { ok: false, error: 'ctx.exec no disponible', at: new Date().toISOString() };

  var apis = [
    { url: 'http://ip-api.com/json/', name: 'ip-api' },
    { url: 'https://ipapi.co/json/', name: 'ipapi' },
    { url: 'https://ipwho.is/', name: 'ipwho' }
  ];

  for (var i = 0; i < apis.length; i++) {
    try {
      var cmd = "Get-Date | Out-Null; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Invoke-RestMethod -Uri '" + apis[i].url + "' -UseBasicParsing -TimeoutSec 8 | ConvertTo-Json -Compress";
      var raw = await ctx.exec(cmd);
      if (!raw || raw.indexOf('{') === -1) continue;
      var jsonStr = raw.substring(raw.indexOf('{'));
      var lastBrace = jsonStr.lastIndexOf('}');
      if (lastBrace !== -1) jsonStr = jsonStr.substring(0, lastBrace + 1);
      var data = JSON.parse(jsonStr);
      var loc = null;
      if (data.query && data.lat !== undefined && data.lon !== undefined) {
        loc = { ip: data.query, city: data.city, region: data.regionName, country: data.country, lat: data.lat, lon: data.lon };
      } else if (data.ip && data.latitude !== undefined && data.longitude !== undefined) {
        loc = { ip: data.ip, city: data.city, region: data.region, country: data.country_name || data.country, lat: data.latitude, lon: data.longitude };
      }
      if (loc && loc.lat && loc.lon) return { ok: true, location: loc, at: new Date().toISOString() };
    } catch (e) { continue; }
  }
  return { ok: false, error: 'No se pudo obtener ubicacion. Verifica conexion a internet.', at: new Date().toISOString() };
} };
