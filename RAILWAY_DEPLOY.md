# 🚂 Railway Deployment Guide — BOL-LMS

This project is a **monorepo** with three deployable services:

| Service | Directory | Description |
|---------|-----------|-------------|
| `api` | `server/` | Go (Gin) REST + WebSocket backend |
| `client` | `client/` | React/Vite SPA served via Nginx |
| `postgres` | Railway Plugin | PostgreSQL database |

> **MinIO / Object Storage**: Railway does not provide MinIO natively.  
> Use **Railway's MinIO template**, a self-hosted MinIO service, or swap to an S3-compatible provider (e.g. Cloudflare R2, Backblaze B2).

---

## 1. Prerequisites

- A [Railway](https://railway.app) account
- Railway CLI installed: `npm i -g @railway/cli` then `railway login`

---

## 2. Project Setup on Railway

### 2a. Via Railway Dashboard (recommended)

1. Go to [railway.app/new](https://railway.app/new)
2. Select **"Deploy from GitHub repo"**
3. Connect your GitHub repository

### 2b. Via CLI

```bash
railway init
```

---

## 3. Add Services

### 3a. PostgreSQL

1. In your Railway project → **+ New Service** → **Database** → **PostgreSQL**
2. Railway will set `DATABASE_URL` automatically on the service.
3. The `api` service will need `POSTGRES_DSN` — use Railway's **reference variables**:
   ```
   POSTGRES_DSN=${{Postgres.DATABASE_URL}}
   ```

### 3b. Backend API (`server/`)

1. **+ New Service** → **GitHub Repo** → select your repo
2. Set **Root Directory** to `server`
3. Railway will detect `server/railway.json` and use the Dockerfile automatically

#### Required Environment Variables for `api`:

| Variable | Value |
|---|---|
| `PORT` | Set automatically by Railway |
| `JWT_SECRET` | A long random string (use `openssl rand -hex 32`) |
| `JWT_EXPIRY_HOURS` | `72` |
| `POSTGRES_DSN` | `${{Postgres.DATABASE_URL}}` |
| `MINIO_ENDPOINT` | Your MinIO host (e.g. `minio.yourdomain.com`) |
| `MINIO_ACCESS_KEY` | Your MinIO access key |
| `MINIO_SECRET_KEY` | Your MinIO secret key |
| `MINIO_USE_SSL` | `true` (if using HTTPS) |
| `MINIO_BUCKET_VIDEOS` | `bol-lms-videos` |
| `MINIO_BUCKET_DOCS` | `bol-lms-documents` |
| `DUMMY_SUPERADMIN_EMAIL` | `superadmin@yourdomain.com` |
| `DUMMY_SUPERADMIN_PASSWORD` | A secure password |
| `DUMMY_ADMIN_EMAIL` | `admin@yourdomain.com` |
| `DUMMY_ADMIN_PASSWORD` | A secure password |
| `DUMMY_USER_EMAIL` | `user@yourdomain.com` |
| `DUMMY_USER_PASSWORD` | A secure password |

### 3c. Frontend Client (`client/`)

1. **+ New Service** → **GitHub Repo** → select your repo
2. Set **Root Directory** to `client`
3. Railway will detect `client/railway.json` and use the Dockerfile automatically

#### Required Environment Variables for `client`:

| Variable | Value |
|---|---|
| `PORT` | Set automatically by Railway |
| `VITE_API_URL` | The Railway public URL of your `api` service (e.g. `https://api-production-xxxx.up.railway.app`) |

> **Important**: `VITE_API_URL` is a **build-time** variable. Set it before the first deploy  
> or trigger a redeploy after setting it.

---

## 4. Custom Domains

- In each service → **Settings** → **Domains** → **Generate Domain** or add your own.
- Suggested setup:
  - `api.yourdomain.com` → `api` service
  - `app.yourdomain.com` → `client` service

---

## 5. Deploy via CLI

```bash
# Deploy the backend
cd server
railway up --service api

# Deploy the frontend
cd ../client
railway up --service client
```

---

## 6. Health Check

The `api` service exposes a health check at:

```
GET /health
```

Railway is configured to probe this endpoint (`healthcheckPath: "/health"` in `server/railway.json`).

---

## 7. WebSocket Support

Railway supports WebSockets out of the box. The Go server handles WebSocket upgrades at `/ws`.  
Make sure your frontend sets `VITE_API_URL` to the `api` service URL so WebSocket connections  
use `wss://` in production.

---

## 8. Environment Variable Quick Reference

### `server/` service

```env
JWT_SECRET=<run: openssl rand -hex 32>
JWT_EXPIRY_HOURS=72
POSTGRES_DSN=${{Postgres.DATABASE_URL}}
MINIO_ENDPOINT=your-minio-host:9000
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
MINIO_USE_SSL=false
MINIO_BUCKET_VIDEOS=bol-lms-videos
MINIO_BUCKET_DOCS=bol-lms-documents
DUMMY_SUPERADMIN_EMAIL=superadmin@bol-lms.com
DUMMY_SUPERADMIN_PASSWORD=change_me
DUMMY_ADMIN_EMAIL=admin@bol-lms.com
DUMMY_ADMIN_PASSWORD=change_me
DUMMY_USER_EMAIL=user@bol-lms.com
DUMMY_USER_PASSWORD=change_me
```

### `client/` service

```env
VITE_API_URL=https://<your-api-railway-domain>
```

---

## 9. File Summary

| File | Purpose |
|------|---------|
| `server/railway.json` | Railway config for the Go API service |
| `client/railway.json` | Railway config for the React frontend service |
| `server/Dockerfile` | Multi-stage Docker build for the Go backend |
| `client/Dockerfile` | Multi-stage Docker build (Bun + Nginx) for the frontend |
| `client/nginx.conf` | Nginx template — uses `$PORT` injected by Railway at runtime |
| `server/.env.example` | Reference for all required backend environment variables |
