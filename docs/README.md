# Docs

Questo folder contiene la documentazione operativa e funzionale del progetto.

## Deploy Stage (GCP/GKE)

La procedura completa di deploy in stage e' disponibile qui:

- `docs/stage-deploy-gcp.md`

## Deploy Stage (VM singola)

La procedura completa di deploy stage su una singola VM e' disponibile qui:

- `docs/stage-deploy-single-vm.md`

### Quickstart

1. Autenticati su GCP e seleziona il progetto.
2. Configura Docker per Artifact Registry.
3. Builda e pusha immagini backend/frontend con tag di release.
4. Crea namespace `stage` su cluster GKE.
5. Prepara i file values Helm stage:
   - `helm/backend/values-stage.yaml`
   - `helm/frontend/values-stage.yaml`
6. Esegui deploy/upgrade con Helm.
7. Verifica pod/ingress e healthcheck API.
8. In caso di problemi, esegui rollback con `helm rollback`.

Per i comandi esatti e tutti i parametri usa la guida completa:

- `docs/stage-deploy-gcp.md`

## Avvio ambiente debug con Docker Compose

Usa il file `docker-compose.debug.yml` per sviluppo locale con hot-reload.

### Avvio

```bash
docker compose -f docker-compose.debug.yml up --build
```

### Servizi disponibili

- Frontend (Vite): `http://localhost:5173`
- Backend API: `http://127.0.0.1:3000`
- Bun Inspector (backend): `127.0.0.1:9229`
- Adminer: `http://127.0.0.1:8888`
- MinIO API: `http://127.0.0.1:9000`
- MinIO Console: `http://127.0.0.1:9001`
- PostgreSQL: `127.0.0.1:5432`

Tutte le porte sono pubblicate solo su loopback. `POSTGRES_PASSWORD`, `MINIO_ROOT_USER`,
`MINIO_ROOT_PASSWORD` e `JWT_SECRET` sono obbligatorie nel `.env` (nessun default).

Nota: il seed dati (`02-test-data.sh`) NON parte piu' di default: e' opt-in con
`--profile demo`, richiede `DEMO_PASSWORD_HASH` e gira solo se la tabella `users` e' vuota
(vedi `docs/configuration_deploy_debug.md`, "Profilo demo").

### Log

```bash
docker compose -f docker-compose.debug.yml logs -f
```

### Stop

```bash
docker compose -f docker-compose.debug.yml down
```

### Stop e reset completo dei volumi

```bash
docker compose -f docker-compose.debug.yml down -v
```
