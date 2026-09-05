var getLocation = { id: 'get-location', version: '1.0.0', run: async function(params, ctx) {
  try {
    var fetchFn = (typeof fetch !== 'undefined') ? fetch : null;
    if (ctx.fetch) fetchFn = ctx.fetch;
    if (!fetchFn) return { ok: false, error: 'fetch no disponible', at: new Date().toISOString() };
    var resp = await fetchFn('https://ipapi.co/json/');
    var data = await resp.json();
    return { ok: true, location: { ip: data.ip, city: data.city, region: data.region, country: data.country_name, lat: data.latitude, lon: data.longitude }, at: new Date().toISOString() };
  } catch (e) { return { ok: false, error: e.message, at: new Date().toISOString() }; }
} };
