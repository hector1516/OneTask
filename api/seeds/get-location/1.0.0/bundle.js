// get-location 1.0.0 — Obtiene ubicacion aproximada por IP.
// Core SDK: ctx.fetch() o fetch nativo del sandbox

const now = () => new Date().toISOString();

export default {
  id: 'get-location',
  version: '1.0.0',
  async run(params = {}, ctx = {}) {
    try {
      const fetchFn = ctx.fetch ?? globalThis.fetch;
      if (!fetchFn) {
        return { ok: false, error: 'fetch not available', queriedAt: now() };
      }
      const resp = await fetchFn('https://ipapi.co/json/');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const location = {
        ip: data.ip,
        city: data.city,
        region: data.region,
        country: data.country_name,
        countryCode: data.country_code,
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone,
        org: data.org,
      };
      if (params.notify !== false && ctx.notify) {
        await ctx.notify('Ubicacion', `${location.city}, ${location.country} (${location.ip})`);
      }
      return { ok: true, location, queriedAt: now() };
    } catch (err) {
      return { ok: false, error: err.message, queriedAt: now() };
    }
  },
};
