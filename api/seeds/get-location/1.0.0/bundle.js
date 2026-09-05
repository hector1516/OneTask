// get-location 1.0.0 — Ubicacion por IP
var getLocation = {
  id: 'get-location',
  version: '1.0.0',
  run: async function(params, ctx) {
    try {
      var resp = await fetch('https://ipapi.co/json/');
      var data = await resp.json();
      return { ok: true, location: { ip: data.ip, city: data.city, country: data.country_name, lat: data.latitude, lon: data.longitude }, at: new Date().toISOString() };
    } catch (e) {
      return { ok: false, error: e.message, at: new Date().toISOString() };
    }
  }
};
if (typeof module !== 'undefined') module.exports = { default: getLocation };
