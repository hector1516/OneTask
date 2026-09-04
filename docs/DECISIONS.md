# OneTask — Decisiones (Server + Agent)

Alineado a **OneTask Agent** `com.onetask.agent` v0.1.0 (Tauri: tray + Buffer + overlay,
`VITE_ONETASK_API_BASE_URL`, `identifier`/`productName` respetados, pull firmado).
El Agent ya existe; este repo (API + Admin en Docker) lo orquesta. El Agent hace
**pull**, nunca push; el server genera y distribuye.

## DEC-001 — Módulos como bundles firmados (server genera)

- Artefacto por módulo: `storage/modules/<id>/<version>/{manifest.json, bundle.js}`.
- `manifest.json`: `{id,name,version,description,entry,minCoreVersion,permissions,hash,signature,configSchema}`.
- `bundle.js`: ESM puro, sin imports remotos, ejecuta en el sandbox del Agent.
- `hash = "sha256:<hex>"` de `bundle.js`. `signature` = Ed25519(priv) sobre los
  bytes canónicos del manifest **sin** `signature` (JSON con claves ordenadas).
- Clave privada en `MODULE_SIGNING_PRIVATE_KEY`; pubkey embebida en el Agent y
  expuesta en `GET /api/v1/public-key` para rotación.
- Seed: `system-monitor` mock `1.0.0` (ver `api/seeds/`).

## DEC-003 — Auth JWT en localStorage

- `POST /auth/login` → `{accessToken (15m), refreshToken (7d)}`.
- Admin guarda ambos en `localStorage` (`onetask_access`, `onetask_refresh`) y envía
  `Authorization: Bearer <access>`. Al 401, reintenta vía `POST /auth/refresh`.
- Agent usa el mismo esquema Bearer contra `/api/v1/me/*` (+ `?deviceId=` o
  `X-Device-Id`). Sin token no hay pull ni push de resultados.

## DEC-004 — Distribución y verificación

- `GET /api/v1/me/modules` devuelve `[{manifest, bundleUrl, signature, hash}]`
  filtrado por `deviceId`/usuario y `minCoreVersion` del core del Agent.
- El Agent verifica `SHA256(bundle) == manifest.hash` **y** `Ed25519_verify(pubkey,
  manifest-sin-signature, signature)` antes de ejecutar. Si falla, descarta y
  reporta `failed`. `permissions` fuera de whitelist → rechazo.
- `bundleUrl` es relativo al API (`/api/v1/modules/<id>/<version>/bundle.js`).
- CORS del API solo permite `https://api.onetask.internal` (+ localhost dev),
  en línea con la CSP del Agent.

## DEC-005 rev — Host-editor silencioso (documentado, NO aquí)

- La edición de hosts requiere privilegios de SO; por diseño **no** se implementa
  en el contenedor web ni en el bundle JS. Vía servicio nativo del host con IPC
  local (decisión del Agent, revisada). Este server solo encola el módulo y
  audita el resultado reportado.

## DEC-007 — Cola pull + heartbeat (offline-first)

- Tabla `module_queue`: `id, deviceId, moduleId, version, params JSON, priority,
  status pending|running|done|failed, queuedAt, startedAt, finishedAt`.
- Admin puede encolar **incluso offline** (`POST /api/v1/devices/:id/queue`).
- Agent polling `GET /me/queue` cada 15 min (+ boot) → ejecuta FIFO por
  `priority DESC, queuedAt ASC` → reporta `POST /api/v1/results`:
  ```json
  { "deviceId": "agent-dev-01",
    "module": {"id":"system-monitor","name":"System Monitor","description":"...","version":"1.0.0"},
    "queue": {"total":3,"pending":1,"running":1,"done":1},
    "execution": {"status":"done","queuedAt":"...","startedAt":"...","finishedAt":"..."},
    "reportedAt": "..." }
  ```
- Sin red, el Agent guarda resultados en local y los vacía al reconectar.
- Cada contacto (`/me/*`, `/results`) actualiza `devices.last_heartbeat`.
  `GET /devices` y `/devices/:id/status` derivan `online` con
  `ONLINE_THRESHOLD_SEC` (def. 300s) y exponen `queue.{total,pending,running,done}`.

## DEC-009 — Overlay silencioso vía servicio (documentado, NO aquí)

- Como DEC-005: el overlay/tray del Agent lo gestiona el binario Tauri local.
  El server solo distribuye el bundle y muestra estado en Admin. Sin endpoints
  de control remoto del overlay.

## Admin web (mobile-first)

- Casi todo el uso será desde el teléfono: UI **mobile-first** (cards, objetivos
  táctiles ≥48px, `viewport-fit=cover`, `font-size:16px` en inputs para evitar el
  zoom de iOS, resultados colapsables). Desktop mejora vía media queries.
- Login, lista dispositivos (online/offline por heartbeat), detalle device →
  Buffer, botón Encolar, visor de resultados. Usa `VITE_API_URL`.

## Compatibilidad Agent v0.1.0

- `identifier`: `com.onetask.agent`, `productName`: `OneTask Agent` (no renombrar).
- `VITE_ONETASK_API_BASE_URL` del Agent apunta al API de este compose.
- `minCoreVersion` en manifests: el Agent ignora módulos con core mayor al suyo.
- Permisos whitelist v0.1.0: `system.read`, `fs.read`, `net.fetch`,
  `clipboard.read`, `overlay.show`, `tray.notify`.
