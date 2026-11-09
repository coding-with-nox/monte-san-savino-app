# Laptop Package

Prerequisite: Docker Desktop.

Start:

```powershell
./start-prod.ps1
```

This uses prebuilt GHCR images and does not require Visual Studio, Bun, Node, or a debug session.

URLs:

- App: http://localhost:8080
- API (through nginx): http://localhost:8080/api (e.g. `/api/health`)

PostgreSQL, the backend (3000) and the MinIO console (9001) are not published on the host; the MinIO
S3 API is bound to `127.0.0.1:9000` only (model images are loaded by the browser from there).

Secrets: `POSTGRES_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` and `JWT_SECRET` have no
defaults. `start-prod.ps1` generates random values for the missing ones in `.env` (never printed).
If you already run an older package (volume `*_pgdata` created with the old default password
`postgres`), set `POSTGRES_PASSWORD=postgres` in `.env` first (then change it with `ALTER USER`);
the script refuses to generate a new one over an existing database.

This package ships no demo/test users and no seed script: the database starts empty. Create the
first admin through the application/your own procedure.

If GHCR images are private, login first:

```powershell
docker login ghcr.io
```