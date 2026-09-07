# OneTask Server — Documentación Completa de Implementación

## Índice
1. [Resumen del Proyecto](#1-resumen-del-proyecto)
2. [Arquitectura](#2-arquitectura)
3. [Credenciales y Accesos](#3-credenciales-y-accesos)
4. [Infraestructura](#4-infraestructura)
5. [Requisitos Previos](#5-requisitos-previos)
6. [Instalación Paso a Paso](#6-instalación-paso-a-paso)
7. [API Endpoints](#7-api-endpoints)
8. [Módulos del Agent](#8-módulos-del-agent)
9. [Admin Dashboard](#9-admin-dashboard)
10. [Cloudflare Tunnels](#10-cloudflare-tunnels)
11. [ZeroTier Network](#11-zerotier-network)
12. [Base de Datos](#12-base-de-datos)
13. [Firma de Módulos (Ed25519)](#13-firma-de-módulos)
14. [Troubleshooting](#14-troubleshooting)
15. [Archivos Importantes](#15-archivos-importantes)

---

## 1. Resumen del Proyecto

OneTask es un sistema de gestión remota de PCs compuesto por:
- **API Server** (Express + TypeScript) — backend REST
- **Admin Web** (Vite + React) — dashboard de administración mobile-first
- **Agent** (Tauri) — cliente que corre en cada PC y ejecuta módulos
- **MySQL 8** — base de datos

El Agent hace pull periódico al server, descarga tareas de una cola, ejecuta módulos (JS) y reporta resultados.

---

## 2. Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    CLOUDFLARE TUNNELS                    │
│  onetask.ecc-sa.com.mx → :5173 (Admin)                 │
│  api.onetask.ecc-sa.com.mx → :3000 (API)               │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                   SERVERVM (Windows)                     │
│  Docker Desktop                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │
│  │  nginx:80   │ │ api:3000    │ │ mysql:3306      │   │
│  │  (Admin UI) │ │ (Express)   │ │ (MySQL 8)       │   │
│  └─────────────┘ └─────────────┘ └─────────────────┘   │
│  C:\OneTask\                                            │
│  IP LAN: 192.168.1.66                                   │
│  IP ZeroTier: 172.26.90.159                             │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                    ZEROTIER NETWORK                      │
│  Network ID: 023910af6b                                 │
│  Agent PC + ServerVM en misma red virtual               │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                     AGENT (Tauri)                        │
│  PC de Hector                                           │
│  Device ID: Oddly Sloth                                 │
│  Device Name: PC de Hector                              │
│  Polling: http://172.26.90.159:3000                     │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Credenciales y Accesos

### Admin Web
| Campo | Valor |
|-------|-------|
| URL Local | `http://192.168.1.66:5173` |
| URL ZeroTier | `http://172.26.90.159:5173` |
| URL Cloudflare | `https://onetask.ecc-sa.com.mx` |
| Usuario | `eccsa` |
| Contraseña | `eyccazo` |

### API
| Campo | Valor |
|-------|-------|
| URL Local | `http://192.168.1.66:3000` |
| URL ZeroTier | `http://172.26.90.159:3000` |
| URL Cloudflare | `https://api.onetask.ecc-sa.com.mx` |
| Health Check | `/health` |

### MySQL
| Campo | Valor |
|-------|-------|
| Host | `mysql` (dentro de Docker) / `localhost:3306` (fuera) |
| Root Password | `onetask_root_pw_change_me` |
| Database | `onetask` |
| User | `onetask` |
| Password | `onetask_pw_change_me` |

### SSH al ServerVM
| Campo | Valor |
|-------|-------|
| Host | `192.168.1.66` (LAN) |
| User | `eccsa` |
| Password | `eyccazo` |
| Host Key | `ssh-ed25519 255 SHA256:QClufJSyrTFwVoHmdc1hZTT8k3A/cWYiXMUKICF1iTc` |
| Comando | `plink -hostkey "ssh-ed25519 255 SHA256:QClufJSyrTFwVoHmdc1hZTT8k3A/cWYiXMUKICF1iTc" -pw eyccazo eccsa@192.168.1.66` |

### GitHub
| Campo | Valor |
|-------|-------|
| Repo | `https://github.com/hector1516/OneTask` |
| Branch | `master` |
| Token | `<VER .env>` ⚠️ ROTAR |

### ZeroTier
| Campo | Valor |
|-------|-------|
| Network ID | `023910af6b` |
| ServerVM IP | `172.26.90.159` |
| Agent PC IP | `172.26.90.x` (asignada por ZeroTier) |

### Cloudflare
| Campo | Valor |
|-------|-------|
| Tunnel: onetask | `onetask.ecc-sa.com.mx` → `:5173` |
| Tunnel: api | `api.onetask.ecc-sa.com.mx` → `:3000` |
| cloudflared | Corre como servicio en ServerVM |

---

## 4. Infraestructura

### Docker Containers
| Container | Imagen | Puerto | Descripción |
|-----------|--------|--------|-------------|
| `onetask-mysql` | `mysql:8` | `3306` | Base de datos |
| `onetask-api` | Build from `./api` | `3000` | API REST |
| `onetask-admin` | Build from `./admin` | `5173` → `80` | Admin Web (nginx) |
| `onetask-phpmyadmin` | `phpmyadmin:5.2` | `8080` (opcional) | DB Admin |

### Volúmenes Docker
| Volumen | Uso |
|---------|-----|
| `mysql_data` | Datos de MySQL |
| `modules_storage` | Bundles de módulos firmados |

### Red Docker
- Network: `onetask` (bridge)

---

## 5. Requisitos Previos

### En la PC servidor (Windows):
1. **Docker Desktop** — con WSL2 habilitado
2. **Git** — para clonar el repo
3. **Node.js 20+** — para desarrollo local (opcional)
4. **Cloudflare Tunnel** — `cloudflared` instalado y corriendo como servicio
5. **ZeroTier** — unido a la red `023910af6b`
6. **Puerto 5173 y 3000** — abiertos en firewall

### En la PC del Agent:
1. **OneTask Agent** (Tauri) — `com.onetask.agent` v0.2.2
2. **ZeroTier** — unido a la misma red
3. **Node.js** — para ejecutar módulos (viene con Tauri)

---

## 6. Instalación Paso a Paso

### 6.1 Clonar el repositorio
```bash
git clone https://github.com/hector1516/OneTask.git
cd OneTask
```

### 6.2 Crear archivo .env
```bash
copy .env.example .env
```

Editar `.env` con estos valores:
```env
# MySQL
MYSQL_ROOT_PASSWORD=onetask_root_pw_change_me
MYSQL_DATABASE=onetask
MYSQL_USER=onetask
MYSQL_PASSWORD=onetask_pw_change_me

# API
DB_HOST=mysql
DB_PORT=3306
API_PORT=3000
JWT_SECRET=onetask_jwt_secret_min_32_chars_12345
JWT_REFRESH_SECRET=onetask_jwt_refresh_secret_min_32_chars_12345
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
CORS_ORIGINS=https://api.onetask.internal,https://api.onetask.ecc-sa.com.mx,https://onetask.ecc-sa.com.mx,http://localhost:5173,http://localhost:3000,https://tauri.localhost,http://tauri.localhost,https://com.onetask.agent.localhost,https://app.onetask.localhost,http://172.26.90.159:3000,http://172.26.90.159:5173
ONLINE_THRESHOLD_SEC=300
BUFFER_TTL_HOURS=24
SEED_ADMIN_USERNAME=eccsa
SEED_ADMIN_PASSWORD=eyccazo
SEED_DEVICE_ID=Oddly Sloth
SEED_DEVICE_NAME=PC de Hector
MODULE_SIGNING_PRIVATE_KEY=generate
VITE_API_URL=
ADMIN_PORT=5173
PHPMYADMIN_PORT=8080
```

### 6.3 Generar clave de firma (si no existe)
```bash
node -e "console.log(require('crypto').generateKeyPairSync('ed25519').privateKey.export({format:'der',type:'pkcs8'}).toString('base64'))"
```
Guardar como `onetask-signing.key` en la raíz del proyecto.

### 6.4 Levantar Docker
```bash
docker compose up --build -d
```

### 6.5 Verificar
```bash
# API
curl http://localhost:3000/health

# Admin
curl http://localhost:5173

# Logs
docker compose logs -f api
docker compose logs -f admin
```

---

## 7. API Endpoints

### Públicos (sin auth)
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/public-key` | Clave pública Ed25519 |
| `POST` | `/auth/login` | Login (retorna JWT) |
| `POST` | `/auth/refresh` | Refrescar token |

### Admin (requiere JWT Bearer)
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/devices` | Lista todos los dispositivos |
| `GET` | `/api/v1/devices/:id/status` | Status de un dispositivo |
| `PUT` | `/api/v1/devices/:id` | Renombrar dispositivo |
| `DELETE` | `/api/v1/devices/:id` | Eliminar dispositivo |
| `GET` | `/api/v1/devices/:id/queue` | Cola de un dispositivo |
| `POST` | `/api/v1/devices/:id/queue` | Encolar tarea |
| `DELETE` | `/api/v1/devices/:id/queue` | Cancelar activas |
| `DELETE` | `/api/v1/devices/:id/queue/all` | Vaciar buffer |
| `DELETE` | `/api/v1/devices/:id/queue/:itemId` | Cancelar tarea específica |
| `GET` | `/api/v1/devices/:id/results` | Resultados de un dispositivo |
| `DELETE` | `/api/v1/devices/:id/results` | Borrar todos los resultados |
| `GET` | `/api/v1/devices/:id/info` | Info del sistema almacenada |
| `GET` | `/api/v1/modules` | Lista módulos disponibles |

### Agent (requiere X-Device-Id, sin JWT)
| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/v1/heartbeat` | Heartbeat del Agent |
| `GET` | `/api/v1/me/queue` | Obtener tareas pendientes |
| `GET` | `/api/v1/me/queue/bundle/:moduleId/:version` | Descargar bundle |
| `POST` | `/api/v1/results` | Reportar resultado |
| `PUT` | `/api/v1/devices/:id/info` | Guardar info del sistema |

---

## 8. Módulos del Agent

### Módulos disponibles

| ID | Nombre | Descripción | Permisos |
|----|--------|-------------|----------|
| `system-monitor` | System Monitor | CPU/memoria mock | `system.read`, `tray.notify` |
| `block-pc` | Bloquear PC | Bloquea workstation | `system.lock` |
| `restart-pc` | Reiniciar PC | Reinicia Windows | `system.power` |
| `shutdown-pc` | Apagar PC | Apaga Windows | `system.power` |
| `get-location` | Ubicación | IP geolocation | `net.location` |
| `system-info` | System Info | Info completa del sistema | `system.read` |
| `screenshot` | Screenshot | Captura de pantalla | `system.read` |

### Cómo funciona un módulo

Cada módulo es un archivo `bundle.js` que exporta un objeto con `id`, `version` y `run`:

```javascript
var miModulo = {
  id: 'mi-modulo',
  version: '1.0.0',
  run: async function(params, ctx) {
    // params: parámetros enviados desde el Admin
    // ctx: contexto del Agent
    //   ctx.exec(cmd) - ejecutar comando shell
    //   ctx.system.lock() - bloquear PC
    //   ctx.system.restart(delay) - reiniciar
    //   ctx.system.shutdown(delay) - apagar
    //   ctx.fetch - fetch nativo
    //   ctx.deviceId - ID del dispositivo
    return { ok: true, output: { ... } };
  }
};
```

### Formato de los bundles

Los bundles están en `api/seeds/<id>/<version>/`:
- `bundle.js` — código del módulo
- `meta.json` — metadata (nombre, permisos, etc.)

**IMPORTANTE:** Los bundles deben ser **JavaScript plano** (sin `export`, sin `module.exports`) porque el Agent los ejecuta con `new Function()`.

### Endpoints del Agent para módulos
- `GET /api/v1/modules` — lista todos (requiere JWT)
- `GET /api/v1/modules/:id/:version/bundle.js` — descarga bundle (requiere X-Device-Id)

---

## 9. Admin Dashboard

### Estructura del Dashboard (por dispositivo)

```
┌─────────────────────────────────────────────┐
│  ★ Nombre del Dispositivo        [✎ Editar]│
│  ID: device-id                             │
│  ● Online  · Último contacto: ...          │
│  [████████████░░░] 3/5 completados         │
└─────────────────────────────────────────────┘

[TAB: Panel] [TAB: Buffer (2)] [TAB: Historial (5)]

─── TAB: Panel ───────────────────────────────

┌─────────────────────────────────────────────┐
│ 📷 Screenshot                              │
│ ┌─────────────────────────────────────────┐ │
│ │                                         │ │
│ │        (imagen capturada)               │ │
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
│ O: Sin screenshot — ejecuta screenshot     │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 📍 Ubicación                               │
│ Ciudad, Región, País                       │
│ IP pública: x.x.x.x                        │
│ Lat: xx.xxxx · Lon: -xx.xxxx              │
│ [Abrir en Google Maps]                     │
│ O: Sin ubicación — ejecuta get-location    │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🖥️ Sistema                                 │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ SO       │ │ CPU      │ │ RAM      │    │
│ │ Win 11   │ │ i7-12700 │ │ 16384 MB │    │
│ │ Build... │ │ 8/16     │ │ 62%      │    │
│ └──────────┘ └──────────┘ └──────────┘    │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ Hostname │ │ IP       │ │ WiFi     │    │
│ │ MI-PC    │ │ 192.168..│ │ MiRed    │    │
│ └──────────┘ └──────────┘ └──────────┘    │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 💾 Discos                                   │
│ ┌──────────────┐ ┌──────────────┐          │
│ │ Disco C:     │ │ Disco D:     │          │
│ │ NTFS         │ │ NTFS         │          │
│ │ 256GB / 89GB │ │ 1TB / 450GB  │          │
│ │ [████░░░░░]  │ │ [██████░░░]  │          │
│ └──────────────┘ └──────────────┘          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🎮 Gráfica                                  │
│ NVIDIA GeForce RTX 3060                     │
│ VRAM: 12288 MB · Driver: 535.86            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🚀 Enviar Módulo                            │
│ [system-info ▾]                             │
│ [1.0.0]                                    │
│ [{} ]                                      │
│ [▶ Enviar al agente]                       │
└─────────────────────────────────────────────┘
```

---

## 10. Cloudflare Tunnels

### Configuración en ServerVM
```bash
# Instalar cloudflared
# Crear tunnel
cloudflared tunnel create onetask

# Configurar DNS
cloudflared tunnel route dns onetask onetask.ecc-sa.com.mx
cloudflared tunnel route dns onetask api.onetask.ecc-sa.com.mx

# Correr tunnel
cloudflared tunnel run onetask
```

### Configuración del tunnel (YAML)
```yaml
tunnel: <TUNNEL_ID>
credentials-file: C:\Users\<user>\.cloudflared\<TUNNEL_ID>.json

ingress:
  - hostname: onetask.ecc-sa.com.mx
    service: http://localhost:5173
  - hostname: api.onetask.ecc-sa.com.mx
    service: http://localhost:3000
  - service: http_status:404
```

### ⚠️ Problema conocido: Cloudflare Rocket Loader
Cloudflare modifica los tags `<script type="module">` cambiando el `type`. Solución: agregar `data-cfasync="false"` al script en `index.html`:

```html
<script type="module" data-cfasync="false" crossorigin src="/assets/index-XXX.js"></script>
```

Esto se hace automáticamente en el build con el script en `package.json`.

---

## 11. ZeroTier Network

### Configuración
| Campo | Valor |
|-------|-------|
| Network ID | `023910af6b` |
| Network Name | (configurar en zerotier.com) |
| ServerVM IP | `172.26.90.159` |
| IP Range | `172.26.90.0/24` |

### Unir dispositivos
```bash
# En Windows
zerotier-cli join 023910af6b

# Verificar
zerotier-cli listnetworks
```

### En el Agent
El Agent usa la IP de ZeroTier para comunicarse con el API:
```
API_BASE_URL=http://172.26.90.159:3000
```

---

## 12. Base de Datos

### Tablas

#### `users`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | CHAR(36) PK | UUID |
| `username` | VARCHAR(64) UNIQUE | Usuario |
| `password_hash` | VARCHAR(255) | Hash bcrypt |
| `created_at` | TIMESTAMP | Fecha creación |

#### `devices`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | VARCHAR(128) PK | Device ID |
| `name` | VARCHAR(255) | Nombre amigable |
| `owner_user_id` | CHAR(36) FK | Propietario |
| `ip_address` | VARCHAR(45) | IP actual |
| `last_heartbeat` | TIMESTAMP | Último heartbeat |
| `created_at` | TIMESTAMP | Fecha creación |

#### `modules`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | VARCHAR(128) | ID del módulo |
| `version` | VARCHAR(32) | Versión |
| `name` | VARCHAR(255) | Nombre |
| `description` | TEXT | Descripción |
| `entry` | VARCHAR(255) | Archivo entrada |
| `min_core_version` | VARCHAR(32) | Versión mínima Agent |
| `permissions` | JSON | Permisos requeridos |
| `config_schema` | JSON | Schema de configuración |
| `hash` | VARCHAR(128) | SHA-256 del bundle |
| `signature` | VARCHAR(256) | Firma Ed25519 |
| `created_at` | TIMESTAMP | Fecha creación |

#### `module_queue`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INT AUTO_INCREMENT PK | ID de la tarea |
| `deviceId` | VARCHAR(128) FK | Dispositivo |
| `moduleId` | VARCHAR(128) | Módulo a ejecutar |
| `version` | VARCHAR(32) | Versión del módulo |
| `params` | JSON | Parámetros |
| `priority` | INT | Prioridad |
| `status` | ENUM | pending/running/done/failed |
| `queuedAt` | TIMESTAMP | Fecha encolado |
| `startedAt` | TIMESTAMP | Inicio ejecución |
| `finishedAt` | TIMESTAMP | Fin ejecución |

#### `module_results`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INT AUTO_INCREMENT PK | ID del resultado |
| `device_id` | VARCHAR(128) FK | Dispositivo |
| `module_id` | VARCHAR(128) | Módulo ejecutado |
| `module_name` | VARCHAR(255) | Nombre del módulo |
| `module_description` | TEXT | Descripción |
| `module_version` | VARCHAR(32) | Versión |
| `queue_total` | INT | Total en cola |
| `queue_pending` | INT | Pendientes |
| `queue_running` | INT | En ejecución |
| `queue_done` | INT | Completados |
| `exec_status` | VARCHAR(32) | Estado final |
| `exec_queued_at` | TIMESTAMP | Cola timestamp |
| `exec_started_at` | TIMESTAMP | Inicio timestamp |
| `exec_finished_at` | TIMESTAMP | Fin timestamp |
| `reported_at` | TIMESTAMP | Reporte timestamp |
| `raw` | JSON | Resultado completo |
| `created_at` | TIMESTAMP | Fecha creación |

#### `refresh_tokens`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `token` | VARCHAR(512) PK | Token JWT |
| `user_id` | CHAR(36) FK | Usuario |
| `expires_at` | TIMESTAMP | Expiración |
| `created_at` | TIMESTAMP | Fecha creación |

#### `device_system_info`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `device_id` | VARCHAR(128) PK | Dispositivo |
| `info` | JSON | Info del sistema |
| `updated_at` | TIMESTAMP | Última actualización |

### Auto-limpieza
- `module_results`: se eliminan después de 7 días
- `module_queue` (done/failed): se eliminan después de 7 días
- Configurable con `BUFFER_TTL_HOURS` en `.env`

---

## 13. Firma de Módulos

### Algoritmo: Ed25519

### Clave de firma
- Archivo: `onetask-signing.key` en la raíz del proyecto
- Montado en Docker: `/app/onetask-signing.key:ro`
- Clave pública derivada automáticamente

### Flujo
1. El server carga la clave privada al iniciar
2. Al servir un bundle, firma el manifest
3. El Agent verifica la firma con la clave pública
4. Si la firma no coincide, rechaza el módulo

### Endpoint de clave pública
```
GET /api/v1/public-key
Response: { "algorithm": "Ed25519", "publicKey": "MCowBQYDK2VwAyEA..." }
```

---

## 14. Troubleshooting

### Admin no carga (pantalla blanca)
1. Verificar que el contenedor `onetask-admin` esté corriendo
2. Verificar que nginx sirve el HTML: `docker exec onetask-admin cat /usr/share/nginx/html/index.html`
3. Verificar que el JS tiene `data-cfasync="false"` si se usa Cloudflare
4. Hacer Ctrl+Shift+R para limpiar cache del navegador

### Agent no conecta
1. Verificar que ZeroTier esté activo en ambas PCs
2. Probar `curl http://172.26.90.159:3000/health`
3. Verificar que el Agent apunta a la IP correcta de ZeroTier
4. Verificar que el firewall permite puerto 3000

### Módulos no ejecutan
1. Verificar que `ctx.exec` esté definido en el executor del Agent
2. Los bundles deben ser JavaScript plano (sin `export`/`module.exports`)
3. Verificar logs del Agent para errores
4. Verificar que el bundle se descarga: `GET /api/v1/modules/:id/:version/bundle.js`

### Docker no levanta
1. Verificar que `.env` existe y tiene los valores correctos
2. Verificar que los puertos 3000 y 5173 no están en uso
3. Verificar logs: `docker compose logs`
4. Reiniciar Docker Desktop

### Cloudflare 502
1. Verificar que los containers estén corriendo
2. Verificar que cloudflared está corriendo: `sc query cloudflared`
3. Verificar la configuración del tunnel
4. Probar primero en local: `http://192.168.1.66:5173`

---

## 15. Archivos Importantes

```
D:\Antigravity\OneTask\
├── .env                          # Configuración (NO commitear)
├── .env.example                  # Template de configuración
├── docker-compose.yml            # Orquestación Docker
├── onetask-signing.key           # Clave Ed25519 (NO commitear)
│
├── api/
│   ├── Dockerfile                # Build del API
│   ├── package.json              # Dependencias del API
│   ├── src/
│   │   ├── index.ts              # Boot del servidor
│   │   ├── routes.ts             # Todos los endpoints
│   │   ├── db.ts                 # Schema BD + pool
│   │   ├── auth.ts               # Login/JWT/seed
│   │   ├── middleware.ts         # requireAuth, requireDevice
│   │   ├── modules.ts            # CRUD módulos + seeds
│   │   ├── signer.ts             # Ed25519 firma/verificación
│   │   └── manifestSchema.ts     # Validación de manifests
│   └── seeds/                    # Módulos fuente
│       ├── system-monitor/1.0.0/
│       ├── block-pc/1.0.0/
│       ├── restart-pc/1.0.0/
│       ├── shutdown-pc/1.0.0/
│       ├── get-location/1.0.0/
│       ├── system-info/1.0.0/
│       └── screenshot/1.0.0/
│
├── admin/
│   ├── Dockerfile                # Build del Admin (nginx)
│   ├── nginx.conf                # Configuración nginx
│   ├── index.html                # HTML fuente
│   ├── package.json              # Dependencias (Vite+React)
│   ├── vite.config.ts            # Configuración Vite
│   └── src/
│       ├── App.tsx               # UI principal (Dashboard)
│       ├── api.ts                # Fetch con JWT
│       ├── styles.css            # Estilos Metal Slug
│       └── main.tsx              # Entry point
│
├── mysql/
│   └── init/                     # Scripts de inicialización
│
└── storage/
    └── modules/                  # Bundles firmados (generados)
```

---

## Comandos Útiles

```bash
# Ver logs del API
docker compose logs -f api

# Reiniciar solo el API
docker compose restart api

# Rebuild completo
docker compose up --build -d

# Entrar al contenedor del API
docker exec -it onetask-api sh

# Entrar al contenedor de MySQL
docker exec -it onetask-mysql mysql -u onetask -p

# Pull y deploy en ServerVM (vía SSH)
cd /d C:\OneTask && git pull --ff-only && docker compose up --build -d

# Verificar módulos
curl -H "X-Device-Id: test" http://localhost:3000/api/v1/modules

# Encolar tarea de prueba
curl -X POST http://localhost:3000/api/v1/devices/Oddly%20Sloth/queue \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{"moduleId":"screenshot","version":"1.0.0"}'
```

---

*Documento generado el 2026-09-07. Proyecto OneTask Server v0.1.0*
