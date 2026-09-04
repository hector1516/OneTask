import { useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { apiFetch, isLoggedIn, login, logout } from './api';
import { useEffect } from 'react';

function useJson<T>(path: string | null, deps: unknown[] = []): { data: T | null; reload: () => void } {
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
  }, [path, tick, ...deps]);
  return { data, reload: () => setTick((t) => t + 1) };
}

function Login() {
  const nav = useNavigate();
  const [u, setU] = useState('admin');
  const [p, setP] = useState('admin123');
  const [err, setErr] = useState('');
  return (
    <div className="card">
      <h2>OneTask Admin — login</h2>
      <div className="row">
        <input value={u} onChange={(e) => setU(e.target.value)} placeholder="usuario" />
        <input value={p} onChange={(e) => setP(e.target.value)} placeholder="contraseña" type="password" />
        <button
          onClick={async () => {
            try {
              await login(u, p);
              nav('/devices');
            } catch {
              setErr('Credenciales inválidas');
            }
          }}
        >
          Entrar
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
  return (
    <div className="card">
      <div className="row">
        <h2>Dispositivos</h2>
        <button onClick={reload}>Refrescar</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Device</th>
            <th>Estado</th>
            <th>Último heartbeat</th>
            <th>pending / running</th>
          </tr>
        </thead>
        <tbody>
          {(data?.devices ?? []).map((d) => (
            <tr key={d.deviceId}>
              <td>
                <Link to={`/devices/${encodeURIComponent(d.deviceId)}`}>{d.deviceId}</Link>
                <div style={{ opacity: 0.7 }}>{d.name}</div>
              </td>
              <td>
                <span className={`badge ${d.online ? 'online' : 'offline'}`}>{d.online ? 'online' : 'offline'}</span>
              </td>
              <td>{d.lastHeartbeat ?? '—'}</td>
              <td>
                {d.pending} / {d.running}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

function DeviceDetail() {
  const { id = '' } = useParams();
  const deviceId = decodeURIComponent(id);
  const status = useJson<{ online: boolean; lastHeartbeat: string | null; queue: { total: number; pending: number; running: number; done: number } }>(
    `/api/v1/devices/${encodeURIComponent(deviceId)}/status`,
  );
  const queue = useJson<{ queue: QueueItem[]; total: number; pending: number; running: number; done: number }>(
    `/api/v1/devices/${encodeURIComponent(deviceId)}/queue`,
  );
  const results = useJson<{ results: Array<Record<string, unknown>> }>(`/api/v1/devices/${encodeURIComponent(deviceId)}/results`);
  const modules = useJson<{ modules: Array<{ manifest: { id: string; name: string; version: string; description: string } }> }>('/api/v1/modules');
  const [mod, setMod] = useState('system-monitor');
  const [ver, setVer] = useState('1.0.0');
  const [params, setParams] = useState('{}');
  const q = queue.data;
  const pct = q && q.total > 0 ? Math.round((q.done / q.total) * 100) : 0;

  const enqueue = async () => {
    let parsed: unknown = {};
    try {
      parsed = JSON.parse(params || '{}');
    } catch {
      alert('params no es JSON válido');
      return;
    }
    const r = await apiFetch(`/api/v1/devices/${encodeURIComponent(deviceId)}/queue`, {
      method: 'POST',
      body: JSON.stringify({ moduleId: mod, version: ver, params: parsed }),
    });
    if (!r.ok) alert(`Encolar falló: ${await r.text()}`);
    else {
      queue.reload();
      status.reload();
    }
  };

  return (
    <div>
      <Link to="/devices">← dispositivos</Link>
      <div className="card">
        <h2>{deviceId}</h2>
        <p>
          <span className={`badge ${status.data?.online ? 'online' : 'offline'}`}>{status.data?.online ? 'online' : 'offline'}</span>{' '}
          heartbeat: {status.data?.lastHeartbeat ?? '—'}
        </p>
        <p>
          Buffer — total {q?.total ?? 0} · pending {q?.pending ?? 0} · running {q?.running ?? 0} · done {q?.done ?? 0}
        </p>
        <div className="bar">
          <div style={{ width: `${pct}%` }} />
        </div>
        <p>
          {q?.done ?? 0}/{q?.total ?? 0} done ({pct}%)
        </p>
      </div>
      <div className="card">
        <h3>Encolar módulo (funciona incluso offline)</h3>
        <div className="row">
          <select value={mod} onChange={(e) => setMod(e.target.value)}>
            {(modules.data?.modules ?? [{ manifest: { id: 'system-monitor', name: 'System Monitor', version: '1.0.0', description: '' } }]).map((m) => (
              <option key={m.manifest.id} value={m.manifest.id}>
                {m.manifest.name} ({m.manifest.id})
              </option>
            ))}
          </select>
          <input value={ver} onChange={(e) => setVer(e.target.value)} placeholder="versión" style={{ width: 90 }} />
          <input value={params} onChange={(e) => setParams(e.target.value)} placeholder='params JSON' style={{ minWidth: 220 }} />
          <button onClick={enqueue}>Encolar</button>
        </div>
      </div>
      <div className="card">
        <h3>Buffer</h3>
        <table>
          <thead>
            <tr>
              <th>id</th>
              <th>nombre / descripción</th>
              <th>status</th>
              <th>queuedAt / startedAt</th>
            </tr>
          </thead>
          <tbody>
            {(q?.queue ?? []).map((it) => (
              <tr key={it.id}>
                <td>{it.id}</td>
                <td>
                  <b>{it.moduleName}</b> <span style={{ opacity: 0.6 }}>({it.moduleId}@{it.version})</span>
                  <div style={{ opacity: 0.7 }}>{it.moduleDescription}</div>
                </td>
                <td>
                  <span className={`badge ${it.status}`}>{it.status}</span>
                </td>
                <td>
                  {it.queuedAt}
                  <div style={{ opacity: 0.7 }}>{it.startedAt ?? '—'}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="row">
          <h3>Resultados</h3>
          <button onClick={() => { results.reload(); queue.reload(); status.reload(); }}>Refrescar</button>
        </div>
        <pre>{JSON.stringify(results.data?.results ?? [], null, 2)}</pre>
      </div>
    </div>
  );
}

export default function App() {
  const nav = useNavigate();
  if (!isLoggedIn() && location.pathname !== '/login') {
    return (
      <div className="wrap">
        <Login />
      </div>
    );
  }
  return (
    <div className="wrap">
      <nav>
        <b>OneTask Admin</b>
        <Link to="/devices">Dispositivos</Link>
        <button
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
