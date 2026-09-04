# OneTask Server — API + Admin (Docker) para orquestar OneTask Agent
# (`com.onetask.agent` v0.1.0, tray + Buffer + overlay, `VITE_ONETASK_API_BASE_URL`).
#
# Flujo: Agent (Tauri) hace **pull** al API (polling `GET /me/queue` cada 15 min + boot
# y `GET /me/modules`), el server genera/distribuye bundles firmados, Admin encola
# incluso offline, Agent reporta vía `POST /results` (Buffer local si offline).

## Quickstart

```bash
cp .env.example .env
# Edita .env: JWT_SECRET, contraseñas MySQL, MODULE_SIGNING_PRIVATE_KEY (nunca commitear el real)
docker compose up --build
```

- API: http://localhost:3000/health
- Admin: http://localhost:5173 (login con `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`)
- Admin público: https://onetask.ecc-sa.com.mx (Cloudflare Tunnel → puerto 5173)
- phpMyAdmin (opcional): `docker compose --profile tools up phpmyadmin` → http://localhost:8080

## Estructura

```
docker-compose.yml        api + admin + mysql:8 (+ phpmyadmin opcional), red onetask
api/                      Node 20 + Express + TS (genera bundles, firma Ed25519, colas)
admin/                    Vite + React (login, dispositivos, Buffer, encolar, resultados)
mysql/init/               schema + seed mínimo (el API re-aplica idempotentemente)
storage/modules/          bundles generados: <id>/<version>/{manifest.json,bundle.js}
docs/DECISIONS.md         decisiones alineadas al Agent (DEC-001/003/004/005/007/009)
```

## Variables

Ver `.env.example`. Clave: `MODULE_SIGNING_PRIVATE_KEY` (Ed25519, la pubkey se
embebe en el Agent y se expone en `GET /api/v1/public-key`), `JWT_SECRET`,
`VITE_API_URL` (Admin) / `VITE_ONETASK_API_BASE_URL` (Agent).

## Endpoints (JWT `Authorization: Bearer`, DEC-003)

| Método | Ruta | Notas |
|---|---|---|
| POST | `/auth/login`, `/api/v1/auth/login` | `{username,password}` → `{accessToken,refreshToken}` |
| POST | `/auth/refresh`, `/api/v1/auth/refresh` | `{refreshToken}` → `{accessToken}` |
| GET | `/api/v1/me/modules?deviceId=` | `[{manifest,bundleUrl,signature,hash}]` |
| GET | `/api/v1/me/queue?deviceId=` | `{queue,total,pending,running,done}` (DEC-007) |
| POST | `/api/v1/devices/:id/queue` | `{moduleId,version,params,priority}` |
| POST | `/api/v1/results` | payload Agent (ver DECISIONS) |
| GET | `/api/v1/devices` | con `online` por heartbeat |
| GET | `/api/v1/devices/:id/status` | `{online,lastHeartbeat,queue}` |

## Seguridad

CORS restringido (`https://api.onetask.internal` + localhost dev, CSP del Agent),
validación de manifest por JSON Schema, firma Ed25519 obligatoria, `permissions`
whitelisteadas, backups vía volumen `mysql_data`.
`DEC-005 rev` y `DEC-009` (host-editor silencioso vía servicio) documentados en
`docs/DECISIONS.md`, no implementados aquí por diseño.
