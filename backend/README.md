# Backend (Bun + Elysia + DDD)

## Run
```bash
bun install
docker-compose up -d
bun run dev
```

## Docker (GHCR)
```bash
docker build -t ghcr.io/<org>/miniatures-backend:latest .
```

## Swagger
- UI: `http://localhost:3000/docs`

Env (prod):
- JWT_SECRET
- PG_HOST/PG_PORT/PG_DB/PG_USER/PG_PASSWORD
- MINIO_*

Health:
- GET /health
