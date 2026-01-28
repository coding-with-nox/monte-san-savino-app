# Miniatures Contest Platform

Generated: 2025-12-14

## Local quickstart
### 1) Services
```bash
cd backend
docker-compose up -d
```

### Optional: full stack via root docker-compose
The root `docker-compose.yml` pulls prebuilt images from GitHub Container Registry (GHCR). If you see a `denied` error during `docker compose pull` or `docker compose up`, authenticate first:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-username> --password-stdin
docker compose up -d
```

If you do not have access to GHCR, stick with the backend-only compose file above and run the backend/frontend locally in dev mode.

### 2) Backend
```bash
cd backend
bun install
bun run dev
```

### 3) Frontend
```bash
cd frontend
npm install
npm run dev
```

Docs:
- `docs/user-manual.md`
- `docs/user-manual.pdf`
- `helm/` for Kubernetes deployment

## Backend + API overview
- The backend lives in `backend/` and runs on Bun + Elysia. Start it with `bun run dev` and access Swagger at `http://localhost:3000/docs`. This is the authoritative list of endpoints and schemas.
- The frontend lives in `frontend/` and calls the API via `frontend/src/lib/api.ts`. The base URL is `VITE_API_BASE` (defaults to `/api` when unset; the Vite dev server proxies `/api` to `http://localhost:3000`, or set it directly for local dev without a proxy).

### Currently wired FE → BE calls
The React pages call these endpoints:
- `POST /auth/register` from the Login page (registration).
- `POST /auth/login` from the Login page (returns `accessToken`).
- `POST /judge/vote` from the Judge page (requires `Authorization: Bearer <token>` and `judge` role).

### Endpoints available in the backend (not all wired in FE yet)
From the API bootstrap:
- `GET /health` for health checks.
- `POST /models/:modelId/image-upload` to request a signed upload URL (requires `user` role).

If the FE feels disconnected, make sure the frontend dev server is pointing at the backend (`VITE_API_BASE`) and that the backend is running on the same port shown in Swagger.
