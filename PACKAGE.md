# Laptop Package

Prerequisite: Docker Desktop.

Start:

```powershell
./start-prod.ps1
```

This uses prebuilt GHCR images and does not require Visual Studio, Bun, Node, or a debug session.

URLs:

- App: http://localhost:8080
- API docs: http://localhost:3000/docs
- MinIO console: http://localhost:9001

If GHCR images are private, login first:

```powershell
docker login ghcr.io
```