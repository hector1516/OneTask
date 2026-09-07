import { useEffect, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { apiBase, apiFetch, isLoggedIn, login, logout } from './api';

const STATUS_ES: Record<string, string> = {
  pending: '⏳ EN BUFFER',
  running: '▶ EN CURSO',
  done: '★ COMPLETADO',
  failed: '✖ FALLO',
};

function useJson<T>(path: string | null, pollMs?: number): { data: T | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    const load = () => {
      apiFetch(path)
        .then((r) => r.json())
        .then((j) => alive && setData(j as T))
        .catch(() => alive && setData(null));
    };
    load();
    if (pollMs && pollMs > 0) {
      const id = setInterval(load, pollMs);
      return () => { alive = false; clearInterval(id); };
    }
    return () => { alive = false; };
  }, [path, tick, pollMs]);
  return { data, reload: () => setTick((t) => t + 1) };
}

function Login() {
  const nav = useNavigate();
  const [u, setU] = useState('admin');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr('');
    try { await login(u.trim(), p); nav('/devices'); }
    catch (e) { setErr((e as Error).message === 'NETWORK' ? `Sin conexión con el servidor (${apiBase || window.location.host}).` : 'Credenciales inválidas.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="card">
      <img className="hero-logo" src="/logo-white.png" alt="OneTask Command" />
      <h2 style={{ textAlign: 'center' }}><span className="star">★</span> OneTask Command <span className="star">★</span></h2>
      <div className="stack">
        <input value={u} onChange={(e) => setU(e.target.value)} placeholder="Usuario" autoComplete="username" autoCapitalize="off" />
        <input value={p} onChange={(e) => setP(e.target.value)} placeholder="Contraseña" type="password" autoComplete="current-password" onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <button className="btn-block" onClick={submit} disabled={busy}>{busy ? 'Conectando…' : '★ Entrar ★'}</button>
      </div>
      {err && <p className="error-box" style={{ marginBottom: 0 }}>{err}</p>}
    </div>
  );
}

interface Device {
  deviceId: string;
  name: string;
  online: boolean;
  lastHeartbeat: string | null;
  ipAddress: string | null;
  pending: number;
  running: number;
}

function Devices() {
  const { data, reload } = useJson<{ devices: Device[] }>('/api/v1/devices', 15000);
  const devices = data?.devices ?? [];
  const online = devices.filter((d) => d.online).length;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newNames, setNewNames] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');

  const rename = async (deviceId: string) => {
    const name = newNames[deviceId]?.trim();
    if (!name) return;
    const r = await apiFetch(`/api/v1/devices/${encodeURIComponent(deviceId)}`, { method: 'PUT', body: JSON.stringify({ name }) });
    if (r.ok) { setEditingId(null); reload(); }
  };

  const removeDevice = async (deviceId: string) => {
    if (!confirm(`¿Eliminar "${deviceId}"?`)) return;
    const r = await apiFetch(`/api/v1/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' });
    if (r.ok) reload();
  };

  const addDevice = async () => {
    const id = newDeviceId.trim();
    const name = newDeviceName.trim() || id;
    if (!id) return;
    const r = await apiFetch(`/api/v1/devices/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ name }) });
    if (r.ok) { setAdding(false); setNewDeviceId(''); setNewDeviceName(''); reload(); }
  };

  return (
    <div>
      <div className="card">
        <div className="row">
          <h2 style={{ flex: 1, margin: 0 }}><span className="star">★</span> Dispositivos {online}/{devices.length} online</h2>
          <button className="ghost" onClick={() => setAdding(!adding)}>{adding ? '✕' : '＋ Agregar'}</button>
          <button className="ghost" onClick={reload}>↻</button>
        </div>
        {adding && (
          <div className="stack" style={{ marginTop: 10 }}>
            <input value={newDeviceId} onChange={(e) => setNewDeviceId(e.target.value)} placeholder="Device ID (ej: mi-pc)" />
            <input value={newDeviceName} onChange={(e) => setNewDeviceName(e.target.value)} placeholder="Nombre (ej: PC de Hector)" />
            <button className="btn-block" onClick={addDevice}>Agregar dispositivo</button>
          </div>
        )}
      </div>
      <div className="list">
        {devices.map((d) => (
          <Link key={d.deviceId} to={`/devices/${encodeURIComponent(d.deviceId)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="item">
              <div className="title">
                {d.name}
                <button className="ghost" style={{ marginLeft: 8, padding: '2px 8px', fontSize: '0.7rem', minHeight: 'auto' }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingId(editingId === d.deviceId ? null : d.deviceId); setNewNames({ ...newNames, [d.deviceId]: d.name }); }}>✎</button>
                <button className="ghost" style={{ marginLeft: 4, padding: '2px 8px', fontSize: '0.7rem', minHeight: 'auto', color: '#c44' }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeDevice(d.deviceId); }}>✕</button>
              </div>
              {editingId === d.deviceId && (
                <div className="row" style={{ marginTop: 6 }} onClick={(e) => e.preventDefault()}>
                  <input value={newNames[d.deviceId] ?? d.name} onChange={(e) => setNewNames({ ...newNames, [d.deviceId]: e.target.value })} placeholder="Nombre" style={{ width: 200 }} />
                  <button style={{ padding: '4px 10px', minHeight: 'auto' }} onClick={(e) => { e.preventDefault(); rename(d.deviceId); }}>✓</button>
                </div>
              )}
              <div className="sub">{d.deviceId}</div>
              {d.ipAddress && <div className="sub" style={{ color: 'var(--accent)' }}>IP: {d.ipAddress}</div>}
              <div className="meta">
                <span className={`badge ${d.online ? 'online' : 'offline'}`}>{d.online ? '● Online' : '○ Offline'}</span>
                <span className="muted">⏳ {d.pending} en buffer · ▶ {d.running} en curso</span>
              </div>
              <div className="sub">Último contacto: {d.lastHeartbeat ?? 'sin contacto'}</div>
            </div>
          </Link>
        ))}
        {devices.length === 0 && <div className="card muted">Sin dispositivos.</div>}
      </div>
    </div>
  );
}

interface QueueItem { id: number; moduleId: string; moduleName: string; moduleDescription: string; version: string; status: string; queuedAt: string; }
interface ResultRow { moduleId: string; moduleName: string; version: string; status: string; reportedAt: string | null; createdAt: string; raw: unknown; }

function DeviceDetail() {
  const { id = '' } = useParams();
  const deviceId = decodeURIComponent(id);
  const enc = encodeURIComponent(deviceId);
  const status = useJson<{ online: boolean; lastHeartbeat: string | null; queue: { total: number; pending: number; running: number; done: number }; name: string }>(`/api/v1/devices/${enc}/status`, 10000);
  const queue = useJson<{ queue: QueueItem[]; total: number; pending: number; running: number; done: number }>(`/api/v1/devices/${enc}/queue`, 10000);
  const results = useJson<{ results: ResultRow[] }>(`/api/v1/devices/${enc}/results/recent?limit=50`, 15000);
  const modules = useJson<{ modules: Array<{ manifest: { id: string; name: string; version: string } }> }>('/api/v1/modules');
  const sysInfo = useJson<{ info: Record<string, unknown> | null; updatedAt: string | null }>(`/api/v1/devices/${enc}/info`, 15000);
  const [mod, setMod] = useState('system-monitor');
  const [ver, setVer] = useState('1.0.0');
  const [params, setParams] = useState('{}');
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [tab, setTab] = useState<'info' | 'buffer' | 'history'>('info');
  const q = queue.data;
  const pct = q && q.total > 0 ? Math.round((q.done / q.total) * 100) : 0;
  const avail = modules.data?.modules ?? [];

  const rename = async () => {
    if (!newName.trim()) return;
    const r = await apiFetch(`/api/v1/devices/${enc}`, { method: 'PUT', body: JSON.stringify({ name: newName.trim() }) });
    if (r.ok) { setEditingName(false); status.reload(); }
  };

  const enqueue = async () => {
    let parsed: unknown = {};
    try { parsed = JSON.parse(params || '{}'); } catch { alert('params no es JSON válido'); return; }
    setBusy(true);
    const r = await apiFetch(`/api/v1/devices/${enc}/queue`, { method: 'POST', body: JSON.stringify({ moduleId: mod, version: ver, params: parsed }) });
    setBusy(false);
    if (!r.ok) alert(`Error: ${await r.text()}`);
    else { queue.reload(); status.reload(); }
  };

  const cancel = async (itemId: number) => {
    const r = await apiFetch(`/api/v1/devices/${enc}/queue/${itemId}`, { method: 'DELETE' });
    if (r.ok) { queue.reload(); status.reload(); }
  };

  const cancelAll = async () => {
    if (!confirm('¿Cancelar todas las tareas del buffer?')) return;
    const r = await apiFetch(`/api/v1/devices/${enc}/queue`, { method: 'DELETE' });
    if (r.ok) { queue.reload(); status.reload(); }
  };

  const clearAll = async () => {
    if (!confirm('¿Vaciar TODO el buffer?')) return;
    const r = await apiFetch(`/api/v1/devices/${enc}/queue/all`, { method: 'DELETE' });
    if (r.ok) { queue.reload(); status.reload(); }
  };

  const clearResults = async () => {
    if (!confirm('¿Borrar todos los resultados?')) return;
    const r = await apiFetch(`/api/v1/devices/${enc}/results`, { method: 'DELETE' });
    if (r.ok) results.reload();
  };

  // Extract last screenshot & location from results
  const allResults = results.data?.results ?? [];
  let lastScreenshot: string | null = null;
  let lastScreenshotError: string | null = null;
  let lastLocation: { ip?: string; city?: string; region?: string; country?: string; lat?: number; lon?: number } | null = null;
  let lastLocationError: string | null = null;
  for (const r of allResults) {
    const raw = (typeof r.raw === 'object' && r.raw !== null ? r.raw : {}) as Record<string, unknown>;
    const output = (typeof raw.output === 'object' && raw.output !== null ? raw.output : {}) as Record<string, unknown>;
    if (r.moduleId === 'screenshot' && !lastScreenshot) {
      if (output.format === 'png' && typeof output.base64 === 'string') {
        lastScreenshot = output.base64;
      } else if (output.ok === false && output.error) {
        lastScreenshotError = String(output.error);
      }
    }
    if (r.moduleId === 'get-location' && !lastLocation) {
      if (typeof output.location === 'object' && output.location !== null) {
        lastLocation = output.location as any;
      } else if (output.ok === false && output.error) {
        lastLocationError = String(output.error);
      }
    }
    if (lastScreenshot && lastLocation) break;
  }

  // System info — Agent sends flat structure
  const info = (sysInfo.data?.info ?? {}) as Record<string, any>;
  const hostname = info.hostname as string | undefined;
  const osName = info.os_name as string | undefined;
  const osVersion = info.os_version as string | undefined;
  const kernelVersion = info.kernel_version as string | undefined;
  const cpuBrand = info.cpu_brand as string | undefined;
  const cpuCoresPhysical = info.cpu_cores_physical as number | undefined;
  const cpuCoresLogical = info.cpu_cores_logical as number | undefined;
  const cpuUsage = info.cpu_usage_percent as number | undefined;
  const memTotalGB = info.memory_total_gb as number | undefined;
  const memUsedGB = info.memory_used_gb as number | undefined;
  const memAvailGB = info.memory_available_gb as number | undefined;
  const memPercent = memTotalGB && memUsedGB != null ? Math.round((memUsedGB / memTotalGB) * 100) : null;
  const uptimeFormatted = info.uptime_formatted as string | undefined;
  const disks = Array.isArray(info.disks) ? info.disks : [];
  const gpuRaw = info.gpu as string | undefined;

  return (
    <div>
      <Link to="/devices" style={{ fontSize: '0.9rem' }}>← Volver a dispositivos</Link>

      {/* HEADER */}
      <div className="card" style={{ marginTop: 8 }}>
        <div className="row">
          <h2 style={{ flex: 1, margin: 0, wordBreak: 'break-all' }}>
            <span className="star">★</span> {status.data?.name || deviceId}
          </h2>
          {!editingName ? (
            <button className="ghost" style={{ padding: '6px 12px', minHeight: 'auto' }}
              onClick={() => { setNewName(status.data?.name || ''); setEditingName(true); }}>✎ Editar</button>
          ) : (
            <div className="row">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: 160 }} placeholder="Nombre" />
              <button style={{ padding: '6px 12px', minHeight: 'auto' }} onClick={rename}>✓</button>
              <button className="ghost" style={{ padding: '6px 12px', minHeight: 'auto' }} onClick={() => setEditingName(false)}>✕</button>
            </div>
          )}
        </div>
        <div className="muted" style={{ wordBreak: 'break-all' }}>ID: {deviceId}</div>
        <div className="meta row" style={{ marginTop: 8 }}>
          <span className={`badge ${status.data?.online ? 'online' : 'offline'}`}>{status.data?.online ? '● Online' : '○ Offline'}</span>
          <span className="muted">Último contacto: {status.data?.lastHeartbeat ?? 'sin contacto'}</span>
        </div>
        <div className="bar" style={{ marginTop: 8 }}>
          <div style={{ width: `${pct}%` }} />
        </div>
        <div className="muted" style={{ marginTop: 4 }}>{q?.done ?? 0}/{q?.total ?? 0} completados · {q?.pending ?? 0} en buffer · {q?.running ?? 0} en curso</div>
      </div>

      {/* TABS */}
      <div className="tab-bar">
        <button className={`tab ${tab === 'info' ? 'active' : ''}`} onClick={() => setTab('info')}>Panel</button>
        <button className={`tab ${tab === 'buffer' ? 'active' : ''}`} onClick={() => setTab('buffer')}>Buffer ({q?.queue?.length ?? 0})</button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>Historial ({allResults.length})</button>
      </div>

      {/* TAB: INFO */}
      {tab === 'info' && (
        <>
          {/* Screenshot */}
          <div className="card dash-card">
            <div className="dash-card-header">
              <span className="dash-icon">📷</span>
              <h3 style={{ margin: 0 }}>Screenshot</h3>
            </div>
            {lastScreenshot ? (
              <img src={`data:image/png;base64,${lastScreenshot}`} alt="Screenshot" className="screenshot-img" />
            ) : lastScreenshotError ? (
              <div className="dash-empty" style={{borderColor:'var(--red)', color:'#ffb4a2'}}>⚠ Error: {lastScreenshotError}</div>
            ) : (
              <div className="dash-empty">Sin screenshot — ejecuta el módulo <b>screenshot</b></div>
            )}
          </div>

          {/* Location */}
          <div className="card dash-card">
            <div className="dash-card-header">
              <span className="dash-icon">📍</span>
              <h3 style={{ margin: 0 }}>Ubicación</h3>
            </div>
            {lastLocation && lastLocation.lat && lastLocation.lon ? (
              <div>
                <div className="dash-loc-info">{lastLocation.city}, {lastLocation.region}, {lastLocation.country}</div>
                <div className="dash-loc-ip">IP pública: {lastLocation.ip}</div>
                <div className="dash-loc-coords">Lat: {lastLocation.lat} · Lon: {lastLocation.lon}</div>
                <a href={`https://www.google.com/maps?q=${lastLocation.lat},${lastLocation.lon}`} target="_blank" rel="noopener noreferrer" className="btn-maps">Abrir en Google Maps</a>
              </div>
            ) : lastLocationError ? (
              <div className="dash-empty" style={{borderColor:'var(--red)', color:'#ffb4a2'}}>⚠ Error: {lastLocationError}</div>
            ) : (
              <div className="dash-empty">Sin ubicación — ejecuta el módulo <b>get-location</b></div>
            )}
          </div>

          {/* System Info Grid */}
          <div className="card dash-card">
            <div className="dash-card-header">
              <span className="dash-icon">🖥️</span>
              <h3 style={{ margin: 0 }}>Sistema</h3>
              {sysInfo.data?.updatedAt && <span className="muted">Actualizado: {sysInfo.data.updatedAt}</span>}
            </div>
            <div className="sys-grid">
              <div className="sys-cell">
                <div className="sys-label">Sistema Operativo</div>
                <div className="sys-value">{osName ? `${osName} ${osVersion ?? ''}` : '—'}</div>
                <div className="sys-sub">{kernelVersion ? `Build ${kernelVersion}` : '—'}</div>
              </div>
              <div className="sys-cell">
                <div className="sys-label">CPU</div>
                <div className="sys-value">{cpuBrand ?? '—'}</div>
                <div className="sys-sub">{cpuCoresPhysical ? `${cpuCoresPhysical} núcleos / ${cpuCoresLogical ?? '?'} hilos` : '—'}</div>
                <div className="sys-sub">{cpuUsage != null ? `${cpuUsage}%` : ''}</div>
              </div>
              <div className="sys-cell">
                <div className="sys-label">RAM</div>
                <div className="sys-value">{memTotalGB ? `${Math.round(memTotalGB * 1024)} MB` : '—'}</div>
                <div className="sys-sub">{memUsedGB != null ? `Usada: ${Math.round(memUsedGB * 1024)} MB (${memPercent}%)` : '—'}</div>
                {memPercent != null && (
                  <div className="sys-bar"><div className="sys-bar-fill" style={{ width: `${memPercent}%` }} /></div>
                )}
              </div>
              <div className="sys-cell">
                <div className="sys-label">Hostname</div>
                <div className="sys-value">{hostname ?? '—'}</div>
              </div>
              <div className="sys-cell">
                <div className="sys-label">Uptime</div>
                <div className="sys-value">{uptimeFormatted ?? '—'}</div>
              </div>
              <div className="sys-cell">
                <div className="sys-label">Dispositivo</div>
                <div className="sys-value">{info.battery ?? '—'}</div>
                <div className="sys-sub">{info.network ?? ''}</div>
              </div>
            </div>
          </div>

          {/* Disks */}
          <div className="card dash-card">
            <div className="dash-card-header">
              <span className="dash-icon">💾</span>
              <h3 style={{ margin: 0 }}>Discos</h3>
            </div>
            {disks.length > 0 ? (
              <div className="sys-grid">
                {disks.map((d: any, i: number) => {
                  const usedGB = d.used_gb ?? (d.total_gb && d.available_gb ? d.total_gb - d.available_gb : null);
                  const pct = d.total_gb && usedGB != null ? Math.round((usedGB / d.total_gb) * 100) : null;
                  return (
                    <div className="sys-cell" key={i}>
                      <div className="sys-label">Disco {d.mount ?? d.letter ?? i}</div>
                      <div className="sys-value">{d.name || 'Sin nombre'} · {d.fs}</div>
                      <div className="sys-sub">Total: {d.total_gb ?? d.totalGB ?? '?'} GB · Libre: {d.available_gb ?? d.freeGB ?? '?'} GB</div>
                      {pct != null && (
                        <div className="sys-bar"><div className="sys-bar-fill disk-bar" style={{ width: `${pct}%` }} /></div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : <div className="dash-empty">Sin datos de discos</div>}
          </div>

          {/* GPU */}
          <div className="card dash-card">
            <div className="dash-card-header">
              <span className="dash-icon">🎮</span>
              <h3 style={{ margin: 0 }}>Gráfica</h3>
            </div>
            {gpuRaw && gpuRaw !== 'N/A (requiere WMI)' && gpuRaw !== 'N/A' ? (
              <div className="sys-grid">
                <div className="sys-cell">
                  <div className="sys-value">{gpuRaw}</div>
                </div>
              </div>
            ) : <div className="dash-empty">Sin datos de gráfica</div>}
          </div>

          {/* Enviar módulo */}
          <div className="card dash-card">
            <div className="dash-card-header">
              <span className="dash-icon">🚀</span>
              <h3 style={{ margin: 0 }}>Enviar Módulo</h3>
            </div>
            <div className="stack">
              <select value={mod} onChange={(e) => setMod(e.target.value)}>
                {avail.map((m) => (
                  <option key={m.manifest.id} value={m.manifest.id}>{m.manifest.name} ({m.manifest.id})</option>
                ))}
              </select>
              <input value={ver} onChange={(e) => setVer(e.target.value)} placeholder="Versión (p. ej. 1.0.0)" />
              <input value={params} onChange={(e) => setParams(e.target.value)} placeholder='Params JSON (ej: {"intervalSec":60})' />
              <button className="btn-block" onClick={enqueue} disabled={busy}>{busy ? 'Enviando…' : '▶ Enviar al agente'}</button>
            </div>
          </div>
        </>
      )}

      {/* TAB: BUFFER */}
      {tab === 'buffer' && (
        <div className="card dash-card">
          <div className="dash-card-header">
            <span className="dash-icon">📋</span>
            <h3 style={{ margin: 0, flex: 1 }}>Buffer</h3>
            {(q?.queue?.length ?? 0) > 0 && (
              <>
                <button className="ghost btn-sm" onClick={cancelAll}>✕ Cancelar activas</button>
                <button className="ghost btn-sm" onClick={clearAll}>✕ Vaciar todo</button>
              </>
            )}
          </div>
          <div className="list">
            {(q?.queue ?? []).map((it) => (
              <div className="item" key={it.id}>
                <div className="title">{it.moduleName} <span className="muted">#{it.id}</span></div>
                <div className="sub">{it.moduleId}@{it.version}</div>
                {it.moduleDescription ? <div className="sub">{it.moduleDescription}</div> : null}
                <div className="meta">
                  <span className={`badge ${it.status}`}>{STATUS_ES[it.status] ?? it.status}</span>
                  <span className="muted">{it.queuedAt}</span>
                  {(it.status === 'pending' || it.status === 'running') && (
                    <button className="ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => cancel(it.id)}>✕ Cancelar</button>
                  )}
                </div>
              </div>
            ))}
            {(q?.queue?.length ?? 0) === 0 && <div className="dash-empty">Buffer vacío</div>}
          </div>
        </div>
      )}

      {/* TAB: HISTORY */}
      {tab === 'history' && (
        <div className="card dash-card">
          <div className="dash-card-header">
            <span className="dash-icon">📜</span>
            <h3 style={{ margin: 0, flex: 1 }}>Historial</h3>
            <button className="ghost btn-sm" onClick={clearResults}>✕ Borrar todos</button>
            <button className="ghost btn-sm" onClick={() => { results.reload(); queue.reload(); status.reload(); }}>↻</button>
          </div>
          <div style={{ marginTop: 10 }}>
            {allResults.map((r, i) => {
              const raw = (typeof r.raw === 'object' && r.raw !== null ? r.raw : {}) as Record<string, unknown>;
              const output = (typeof raw.output === 'object' && raw.output !== null ? raw.output : {}) as Record<string, unknown>;
              const loc = (typeof output.location === 'object' && output.location !== null ? output.location : null) as any;
              const screenshotB64 = output.format === 'png' && typeof output.base64 === 'string' ? output.base64 : null;
              return (
                <details className="result" key={`${r.createdAt}-${i}`}>
                  <summary>
                    <span className={`badge ${r.status}`}>{STATUS_ES[r.status] ?? r.status ?? '—'}</span>
                    <span>{r.moduleName || r.moduleId}@{r.version}</span>
                  </summary>
                  <div style={{ marginTop: 6 }}>
                    {screenshotB64 && <img src={`data:image/png;base64,${screenshotB64}`} alt="Screenshot" className="screenshot-img" />}
                    {loc && loc.lat && loc.lon && (
                      <div style={{ marginBottom: 8 }}>
                        <span className="sub">📍 {loc.city}, {loc.region}, {loc.country} — IP: {loc.ip}</span>
                        <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lon}`} target="_blank" rel="noopener noreferrer" className="btn-maps" style={{ marginLeft: 8 }}>Maps</a>
                      </div>
                    )}
                    <pre>{JSON.stringify(raw, null, 2)}</pre>
                  </div>
                </details>
              );
            })}
            {allResults.length === 0 && <div className="dash-empty">Sin resultados aún</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const nav = useNavigate();
  if (!isLoggedIn()) {
    return (
      <div className="wrap">
        <Login />
        <div className="foot">★ ONE TASK COMMAND ★ v0.1.0</div>
      </div>
    );
  }
  return (
    <div className="wrap">
      <nav className="topnav">
        <img className="nav-logo" src="/logo-white.png" alt="OneTask" />
        <span className="hq">OneTask Command</span>
        <Link to="/devices">Dispositivos</Link>
        <button className="ghost" onClick={() => { logout(); nav('/login'); }}>Logout</button>
      </nav>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/devices/:id" element={<DeviceDetail />} />
        <Route path="*" element={<Devices />} />
      </Routes>
      <div className="foot">★ ONE TASK COMMAND ★ v0.1.0</div>
    </div>
  );
}
