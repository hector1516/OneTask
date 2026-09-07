var getLocation = { id: 'get-location', version: '1.0.0', run: async function(params, ctx) {
  // Try global fetch first (works in Tauri webview), then ctx.fetch as fallback
  var fetchFn = (typeof fetch !== 'undefined') ? fetch : null;
  if (!fetchFn && ctx.fetch) fetchFn = ctx.fetch;
  if (!fetchFn) return { ok: false, error: 'fetch no disponible en el Agent', at: new Date().toISOString() };
  var apis = [
    { url: 'http://ip-api.com/json/', parse: function(d) { return { ip: d.query, city: d.city, region: d.regionName, country: d.country, lat: d.lat, lon: d.lon }; } },
    { url: 'https://ipapi.co/json/', parse: function(d) { return { ip: d.ip, city: d.city, region: d.region, country: d.country_name, lat: d.latitude, lon: d.longitude }; } },
    { url: 'https://ipwho.is/', parse: function(d) { return { ip: d.ip, city: d.city, region: d.region, country: d.country, lat: d.latitude, lon: d.longitude }; } }
  ];
  for (var i = 0; i < apis.length; i++) {
    try {
      var resp = await fetchFn(apis[i].url);
      if (!resp.ok) continue;
      var data = await resp.json();
      var loc = apis[i].parse(data);
      if (loc.lat && loc.lon) return { ok: true, location: loc, at: new Date().toISOString() };
    } catch (e) { continue; }
  }
  return { ok: false, error: 'No se pudo obtener ubicacion. Verifica conexion a internet.', at: new Date().toISOString() };
} };
