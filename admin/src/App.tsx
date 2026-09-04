import { useEffect, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { apiFetch, isLoggedIn, login, logout } from './api';

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
      await login(u, p);
      nav('/devices');
    } catch {
      setErr('Credenciales inválidas');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card">
      <h2>OneTask Admin</h2>
      <div className="stack">
        <input value={u} onChange={(e) => setU(e.target.value)} placeholder="Usuario" autoComplete="username" />
        <input
          value={p}
          onChange={(e) => setP(e.target.value)}
          placeholder="Contraseña"
          type="password"
          autoComplete="current-password"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button className="btn-block" onClick={submit} disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
      {err && <p>{err}</p>}
    </div>
  );
}

interface Device {
  deviceId: string;
  name: string;
  online: boolean;
  lastHeartbeat: string | null;
  pending: number;
  running: number;
}

function Devices() {
  const { data, reload } = useJson<{ devices: Device[] }>('/api/v1/devices');
  const devices = data?.devices ?? [];
  const online = devices.filter((d) => d.online).length;
  return (
    <div>
      <div className="card">
        <div className="row">
          <h2 style={{ flex: 1, margin: 0 }}>Dispositivos ({online}/{devices.length} online)</h2>
          <button className="ghost" onClick={reload}>
            ↻
          </button>
        </div>
      </div>
      <div className="list">
        {devices.map((d) => (
          <Link key={d.deviceId} to={`/devices/${encodeURIComponent(d.deviceId)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="item">
              <div className="title">{d.deviceId}</div>
              <div className="sub">{d.name}</div>
              <div className="meta">
                <span className={`badge ${d.online ? 'online' : 'offline'}`}>{d.online ? 'online' : 'offline'}</span>
                <span className="muted">
                  ⏳ {d.pending} pending · ▶ {d.running} running
                </span>
              </div>
              <div className="sub">heartbeat: {d.lastHeartbeat ?? '—'}</div>
            </div>
          </Link>
        ))}
        {devices.length === 0 && <div className="card muted">Sin dispositivos. El Agent aparece aquí tras su primer pull.</div>}
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
  const status = useJson<{ online: boolean; lastHeartbeat: string | null; queue: { total: number; pending: number; running: number; done: number } }>(
    `/api/v1/devices/${enc}/status`,
  );
  const queue = useJson<{ queue: QueueItem[]; total: number; pending: number; running: number; done: number }>(`/api/v1/devices/${enc}/queue`);
  const results = useJson<{ results: ResultRow[] }>(`/api/v1/devices/${enc}/results`);
  const modules = useJson<{ modules: Array<{ manifest: { id: string; name: string; version: string } }> }>('/api/v1/modules');
  const [mod, setMod] = useState('system-monitor');
  const [ver, setVer] = useState('1.0.0');
  const [params, setParams] = useState('{}');
  const [busy, setBusy] = useState(false);
  const q = queue.data;
  const pct = q && q.total > 0 ? Math.round((q.done / q.total) * 100) : 0;
  const avail = modules.data?.modules ?? [{ manifest: { id: 'system-monitor', name: 'System Monitor', version: '1.0.0' } }];

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
    if (!r.ok) alert(`Encolar falló: ${await r.text()}`);
    else {
      queue.reload();
      status.reload();
    }
  };

  return (
    <div>
      <Link to="/devices">← dispositivos</Link>
      <div className="card" style={{ marginTop: 8 }}>
        <h2 style={{ wordBreak: 'break-all' }}>{deviceId}</h2>
        <div className="meta row">
          <span className={`badge ${status.data?.online ? 'online' : 'offline'}`}>{status.data?.online ? 'online' : 'offline'}</span>
          <span className="muted">heartbeat: {status.data?.lastHeartbeat ?? '—'}</span>
        </div>
        <p className="muted" style={{ margin: '8px 0' }}>
          {q?.done ?? 0}/{q?.total ?? 0} done ({pct}%) · {q?.pending ?? 0} pending · {q?.running ?? 0} running
        </p>
        <div className="bar">
          <div style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="card">
        <h3>Encolar módulo</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Funciona incluso con el Agent offline (cola DEC-007).
        </p>
        <div className="stack">
          <select value={mod} onChange={(e) => setMod(e.target.value)}>
            {avail.map((m) => (
              <option key={m.manifest.id} value={m.manifest.id}>
                {m.manifest.name} ({m.manifest.id})
              </option>
            ))}
          </select>
          <input value={ver} onChange={(e) => setVer(e.target.value)} placeholder="Versión (p. ej. 1.0.0)" inputMode="text" />
          <input value={params} onChange={(e) => setParams(e.target.value)} placeholder='Params JSON (p. ej. {"intervalSec":60})' inputMode="text" />
          <button className="btn-block" onClick={enqueue} disabled={busy}>
            {busy ? 'Encolando…' : 'Encolar'}
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Buffer ({q?.queue?.length ?? 0})</h3>
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
                <span className={`badge ${it.status}`}>{it.status}</span>
                <span className="muted">{it.queuedAt}</span>
              </div>
            </div>
          ))}
          {(q?.queue?.length ?? 0) === 0 && <div className="muted">Cola vacía.</div>}
        </div>
      </div>

      <div className="card">
        <div className="row">
          <h3 style={{ flex: 1, margin: 0 }}>Resultados ({results.data?.results?.length ?? 0})</h3>
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
                <span className={`badge ${r.status}`}>{r.status || '—'}</span>
                <span>
                  {r.moduleName || r.moduleId}@{r.version}
                </span>
              </summary>
              <pre>{JSON.stringify(r.raw ?? r, null, 2)}</pre>
            </details>
          ))}
          {(results.data?.results?.length ?? 0) === 0 && <div className="muted">Sin resultados todavía.</div>}
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
      </div>
    );
  }
  return (
    <div className="wrap">
      <nav className="topnav">
        <b>OneTask Admin</b>
        <Link to="/devices">Equipos</Link>
        <button
          className="ghost"
          onClick={() => {
            logout();
            nav('/login');
          }}
        >
          Salir
        </button>
      </nav>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/devices/:id" element={<DeviceDetail />} />
        <Route path="*" element={<Devices />} />
      </Routes>
    </div>
  );
}
