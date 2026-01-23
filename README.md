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
