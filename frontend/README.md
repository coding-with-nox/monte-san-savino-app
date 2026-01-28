# Frontend (React + Vite)

## Run
```bash
npm install
npm run dev
```

## Env
- `VITE_API_BASE=/api` (default when unset; the Vite dev server proxies `/api` to `http://localhost:3000`).
- Set `VITE_API_BASE=http://localhost:3000` if you prefer to bypass the proxy.

## Docker (GHCR)
```bash
docker build -t ghcr.io/<org>/miniatures-frontend:latest .
```
