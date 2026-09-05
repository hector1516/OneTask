import { useEffect, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { apiBase, apiFetch, isLoggedIn, login, logout } from './api';

const STATUS_ES: Record<string, string> = {
  pending: '⏳ EN BUFFER',
  running: '▶ EN CURSO',
  done: '★ COMPLETADO',
  failed: '✖ FALLO',
};

function useJson<T>(path: string | null): { data: T | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    apiFetch(path)
      .then((r) => r.json())
      .then((j) => alive && setData(j as T))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick]);
  return { data, reload: () => setTick((t) => t + 1) };
}

function Login() {
  const nav = useNavigate();
  const [u, setU] = useState('admin');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      await login(u.trim(), p);
      nav('/devices');
    } catch (e) {
      setErr(
        (e as Error).message === 'NETWORK'
          ? `Sin conexión con el servidor (${apiBase || window.location.host}). Revisa WiFi/red.`
          : 'Credenciales inválidas.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card">
      <img className="hero-logo" src="/logo-white.png" alt="OneTask Command" />
      <h2 style={{ textAlign: 'center' }}>
        <span className="star">★</span> OneTask Command <span className="star">★</span>
      </h2>
      <div className="stack">
        <input value={u} onChange={(e) => setU(e.target.value)} placeholder="Usuario" autoComplete="username" autoCapitalize="off" />
        <input
          value={p}
          onChange={(e) => setP(e.target.value)}
          placeholder="Contraseña"
          type="password"
          autoComplete="current-password"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button className="btn-block" onClick={submit} disabled={busy}>
          {busy ? 'Conectando…' : '★ Entrar ★'}
        </button>
      </div>
      {err && (
        <p className="error-box" style={{ marginBottom: 0 }}>
          {err}
        </p>
      )}
    </div>
  );
}

interface Device {
  deviceId: string;
  id: string;
  name: string;
  ipAddress: string | null;
  online: boolean;
  lastHeartbeat: string | null;
  pending: number;
  running: number;
}

function Devices() {
  const { data, reload } = useJson<{ devices: Device[] }>('/api/v1/devices');
  const devices = data?.devices ?? [];
  const online = devices.filter((d) => d.online).length;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newNames, setNewNames] = useState<Record<string, string>>({});

  const rename = async (deviceId: string) => {
    const name = newNames[deviceId]?.trim();
    if (!name) return;
    const r = await apiFetch(`/api/v1/devices/${encodeURIComponent(deviceId)}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    if (r.ok) {
      setEditingId(null);
      reload();
    }
  };

  return (
    <div>
      <div className="card">
        <div className="row">
          <h2 style={{ flex: 1, margin: 0 }}>
            <span className="star">★</span> Dispositivos {online}/{devices.length} online
          </h2>
          <button className="ghost" onClick={reload}>
            ↻
          </button>
        </div>
      </div>
      <div className="list">
        {devices.map((d) => (
          <Link key={d.deviceId} to={`/devices/${encodeURIComponent(d.deviceId)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="item">
              <div className="title">
                {d.name}
                <button
                  className="ghost"
                  style={{ marginLeft: 8, padding: '2px 8px', fontSize: '0.7rem', minHeight: 'auto' }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditingId(editingId === d.deviceId ? null : d.deviceId);
                    setNewNames({ ...newNames, [d.deviceId]: d.name });
                  }}
                >
                  ✎
                </button>
              </div>
              {editingId === d.deviceId && (
                <div className="row" style={{ marginTop: 6 }} onClick={(e) => e.preventDefault()}>
                  <input
                    value={newNames[d.deviceId] ?? d.name}
                    onChange={(e) => setNewNames({ ...newNames, [d.deviceId]: e.target.value })}
                    placeholder="Nombre"
                    style={{ width: 200 }}
                  />
                  <button
                    style={{ padding: '4px 10px', minHeight: 'auto' }}
                    onClick={(e) => {
                      e.preventDefault();
                      rename(d.deviceId);
                    }}
                  >
                    ✓
                  </button>
                </div>
              )}
              <div className="sub">{d.deviceId}</div>
              {d.ipAddress && <div className="sub" style={{ color: 'var(--accent)' }}>IP: {d.ipAddress}</div>}
              <div className="meta">
                <span className={`badge ${d.online ? 'online' : 'offline'}`}>{d.online ? '● Online' : '○ Offline'}</span>
                <span className="muted">
                  ⏳ {d.pending} en buffer · ▶ {d.running} en curso
                </span>
              </div>
              <div className="sub">Último contacto: {d.lastHeartbeat ?? 'sin contacto'}</div>
            </div>
          </Link>
        ))}
        {devices.length === 0 && <div className="card muted">Sin dispositivos. El Agent se presenta tras su primer pull.</div>}
      </div>
    </div>
  );
}

interface QueueItem {
  id: number;
  moduleId: string;
  moduleName: string;
  moduleDescription: string;
  version: string;
  status: string;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface ResultRow {
  moduleId: string;
  moduleName: string;
  version: string;
  status: string;
  reportedAt: string | null;
  createdAt: string;
  raw: unknown;
}

function DeviceDetail() {
  const { id = '' } = useParams();
  const deviceId = decodeURIComponent(id);
  const enc = encodeURIComponent(deviceId);
  const status = useJson<{ online: boolean; lastHeartbeat: string | null; queue: { total: number; pending: number; running: number; done: number }; name: string }>(
    `/api/v1/devices/${enc}/status`,
  );
  const queue = useJson<{ queue: QueueItem[]; total: number; pending: number; running: number; done: number }>(`/api/v1/devices/${enc}/queue`);
  const results = useJson<{ results: ResultRow[] }>(`/api/v1/devices/${enc}/results`);
  const modules = useJson<{ modules: Array<{ manifest: { id: string; name: string; version: string } }> }>('/api/v1/modules');
  const [mod, setMod] = useState('system-monitor');
  const [ver, setVer] = useState('1.0.0');
  const [params, setParams] = useState('{}');
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const q = queue.data;
  const pct = q && q.total > 0 ? Math.round((q.done / q.total) * 100) : 0;
  const avail = modules.data?.modules ?? [{ manifest: { id: 'system-monitor', name: 'System Monitor', version: '1.0.0' } }];

  const rename = async () => {
    if (!newName.trim()) return;
    const r = await apiFetch(`/api/v1/devices/${enc}`, {
      method: 'PUT',
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (r.ok) {
      setEditingName(false);
      status.reload();
    }
  };

  const enqueue = async () => {
    let parsed: unknown = {};
    try {
      parsed = JSON.parse(params || '{}');
    } catch {
      alert('params no es JSON válido');
      return;
    }
    setBusy(true);
    const r = await apiFetch(`/api/v1/devices/${enc}/queue`, {
      method: 'POST',
      body: JSON.stringify({ moduleId: mod, version: ver, params: parsed }),
    });
    setBusy(false);
    if (!r.ok) alert(`Error: ${await r.text()}`);
    else {
      queue.reload();
      status.reload();
    }
  };

  const cancel = async (itemId: number) => {
    const r = await apiFetch(`/api/v1/devices/${enc}/queue/${itemId}`, { method: 'DELETE' });
    if (r.ok) {
      queue.reload();
      status.reload();
    }
  };

  const cancelAll = async () => {
    if (!confirm('¿Cancelar todas las tareas del buffer?')) return;
    const r = await apiFetch(`/api/v1/devices/${enc}/queue`, { method: 'DELETE' });
    if (r.ok) {
      queue.reload();
      status.reload();
    }
  };

  const clearAll = async () => {
    if (!confirm('¿Vaciar TODO el buffer? Se borrarán done, failed y pending.')) return;
    const r = await apiFetch(`/api/v1/devices/${enc}/queue/all`, { method: 'DELETE' });
    if (r.ok) {
      queue.reload();
      status.reload();
    }
  };

  const clearResults = async () => {
    if (!confirm('¿Borrar todos los resultados de este dispositivo?')) return;
    const r = await apiFetch(`/api/v1/devices/${enc}/results`, { method: 'DELETE' });
    if (r.ok) results.reload();
  };

  return (
    <div>
      <Link to="/devices">← dispositivos</Link>
      <div className="card" style={{ marginTop: 8 }}>
        <div className="row">
          <h2 style={{ flex: 1, margin: 0, wordBreak: 'break-all' }}>
            <span className="star">★</span> {status.data?.name || deviceId}
          </h2>
          {!editingName ? (
            <button
              className="ghost"
              onClick={() => {
                setNewName(status.data?.name || '');
                setEditingName(true);
              }}
            >
              ✎
            </button>
          ) : (
            <div className="row">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: 160 }} placeholder="Nombre" />
              <button onClick={rename}>✓</button>
              <button className="ghost" onClick={() => setEditingName(false)}>
                ✕
              </button>
            </div>
          )}
        </div>
        <div className="muted" style={{ wordBreak: 'break-all' }}>ID: {deviceId}</div>
        <div className="meta row" style={{ marginTop: 8 }}>
          <span className={`badge ${status.data?.online ? 'online' : 'offline'}`}>{status.data?.online ? '● Online' : '○ Offline'}</span>
          <span className="muted">Último contacto: {status.data?.lastHeartbeat ?? 'sin contacto'}</span>
        </div>
        <p className="muted" style={{ margin: '8px 0' }}>
          {q?.done ?? 0}/{q?.total ?? 0} completados ({pct}%) · {q?.pending ?? 0} en buffer · {q?.running ?? 0} en curso
        </p>
        <div className="bar">
          <div style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="card">
        <h3>＋ Enviar módulo</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Llega al Agent en su próximo pull, aunque esté offline.
        </p>
        <div className="stack">
          <select value={mod} onChange={(e) => setMod(e.target.value)}>
            {avail.map((m) => (
              <option key={m.manifest.id} value={m.manifest.id}>
                {m.manifest.name} ({m.manifest.id})
              </option>
            ))}
          </select>
          <input value={ver} onChange={(e) => setVer(e.target.value)} placeholder="Versión (p. ej. 1.0.0)" />
          <input value={params} onChange={(e) => setParams(e.target.value)} placeholder='Params JSON (p. ej. {"intervalSec":60})' />
          <button className="btn-block" onClick={enqueue} disabled={busy}>
            {busy ? 'Enviando…' : '▶ Enviar al agente'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <h3 style={{ flex: 1, margin: 0 }}>Buffer ({q?.queue?.length ?? 0})</h3>
          {(q?.queue?.length ?? 0) > 0 && (
            <>
              <button
                className="ghost"
                style={{ padding: '4px 10px', minHeight: 'auto', fontSize: '0.75rem' }}
                onClick={cancelAll}
              >
                ✕ Cancelar activas
              </button>
              <button
                className="ghost"
                style={{ padding: '4px 10px', minHeight: 'auto', fontSize: '0.75rem' }}
                onClick={clearAll}
              >
                ✕ Vaciar todo
              </button>
            </>
          )}
        </div>
        <div className="list">
          {(q?.queue ?? []).map((it) => (
            <div className="item" key={it.id}>
              <div className="title">
                {it.moduleName} <span className="muted">#{it.id}</span>
              </div>
              <div className="sub">
                {it.moduleId}@{it.version}
              </div>
              {it.moduleDescription ? <div className="sub">{it.moduleDescription}</div> : null}
              <div className="meta">
                <span className={`badge ${it.status}`}>{STATUS_ES[it.status] ?? it.status}</span>
                <span className="muted">{it.queuedAt}</span>
                {(it.status === 'pending' || it.status === 'running') && (
                  <button
                    className="ghost"
                    style={{ marginLeft: 'auto', padding: '4px 10px', minHeight: 'auto', fontSize: '0.75rem' }}
                    onClick={(e) => {
                      e.preventDefault();
                      cancel(it.id);
                    }}
                  >
                    ✕ Cancelar
                  </button>
                )}
              </div>
            </div>
          ))}
          {(q?.queue?.length ?? 0) === 0 && <div className="muted">Buffer vacío. Todo completado.</div>}
        </div>
      </div>

      <div className="card">
        <div className="row">
          <h3 style={{ flex: 1, margin: 0 }}>Módulos completados ({results.data?.results?.length ?? 0})</h3>
          <button
            className="ghost"
            onClick={clearResults}
            style={{ padding: '4px 10px', minHeight: 'auto', fontSize: '0.75rem' }}
          >
            ✕ Borrar todos
          </button>
          <button
            className="ghost"
            onClick={() => {
              results.reload();
              queue.reload();
              status.reload();
            }}
          >
            ↻
          </button>
        </div>
        <div style={{ marginTop: 10 }}>
          {(results.data?.results ?? []).map((r, i) => (
            <details className="result" key={`${r.createdAt}-${i}`}>
              <summary>
                <span className={`badge ${r.status}`}>{STATUS_ES[r.status] ?? r.status ?? '—'}</span>
                <span>
                  {r.moduleName || r.moduleId}@{r.version}
                </span>
              </summary>
              <pre>{JSON.stringify(r.raw ?? r, null, 2)}</pre>
            </details>
          ))}
          {(results.data?.results?.length ?? 0) === 0 && <div className="muted">Sin resultados aún.</div>}
        </div>
      </div>
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
        <button
          className="ghost"
          onClick={() => {
            logout();
            nav('/login');
          }}
        >
          Logout
        </button>
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
