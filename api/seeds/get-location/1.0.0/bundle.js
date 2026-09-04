// get-location 1.0.0 — Obtiene ubicacion aproximada por IP.

const now = () => new Date().toISOString();

export default {
  id: 'get-location',
  version: '1.0.0',
  async run(params = {}, ctx = {}) {
    try {
      const resp = await fetch('https://ipapi.co/json/');
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
