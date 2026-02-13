# Deploy Stage su VM Singola

Questa guida descrive il deploy dell'app in ambiente `stage` su una singola VM Linux, usando Docker Compose.

## Architettura

- 1 VM (es. Ubuntu 22.04/24.04)
- 1 stack Docker Compose (postgres, minio, backend, frontend)
- (Consigliato) reverse proxy TLS davanti alla porta `8080`

## Prerequisiti

- VM raggiungibile via SSH
- Docker + Docker Compose plugin installati
- Accesso al repository
- (Se immagini private GHCR) token GitHub con permessi pull package

## 1. Preparazione VM

```bash
sudo apt update
sudo apt install -y ca-certificates curl git

# Docker Engine + Compose plugin (pacchetto distro)
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker

# Opzionale: evita sudo con docker
sudo usermod -aG docker $USER
```

Riapri la sessione SSH dopo `usermod`.

## 2. Checkout codice

```bash
mkdir -p ~/apps
cd ~/apps
git clone <REPO_URL> monte-san-savino-app
cd monte-san-savino-app
```

Checkout del branch/tag stage desiderato:

```bash
git fetch --all --tags
git checkout <branch-o-tag-stage>
```

## 3. Configurazione environment

Crea `.env` a partire da `.env.example`:

```bash
cp .env.example .env
```

Aggiorna almeno questi valori in `.env`:

- `JWT_SECRET`
- `POSTGRES_PASSWORD`
- `MINIO_ROOT_PASSWORD`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_PUBLIC_URL` (URL pubblico MinIO se usi file pubblici)
- `RESEND_API_KEY` e `RESEND_FROM_EMAIL` (se vuoi email reset password)

Per deploy single-VM con compose root, lascia:

- `PG_HOST=postgres`
- `MINIO_ENDPOINT=minio`

## 4. (Opzionale) Login GHCR

Serve solo se le immagini GHCR non sono pubbliche:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-username> --password-stdin
```

## 5. Deploy stage

Dalla root del progetto:

```bash
docker compose pull
docker compose up -d
```

Verifica stato:

```bash
docker compose ps
docker compose logs --tail 200 backend frontend postgres minio
```

Health backend:

```bash
curl -i http://localhost:3000/health
```

UI frontend:

- `http://<VM_IP>:8080`

## 6. Aggiornamento release

```bash
cd ~/apps/monte-san-savino-app
git fetch --all --tags
git checkout <nuovo-branch-o-tag-stage>
docker compose pull
docker compose up -d
docker compose ps
```

## 7. Rollback

```bash
cd ~/apps/monte-san-savino-app
git checkout <tag-precedente>
docker compose pull
docker compose up -d
```

## 8. Backup dati (minimo)

I dati persistono nei volumi Docker `pgdata` e `miniodata`.

Esempio dump Postgres:

```bash
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$TENANT_DB_NAME" > backup_stage.sql
```

## 9. Reverse proxy TLS (consigliato)

Esporre direttamente `8080` in stage non e' ideale. Consigliato:

- aprire solo `80/443` in firewall
- reverse proxy (Nginx/Caddy/Traefik) verso `localhost:8080`
- certificati TLS (Let's Encrypt)

## 10. Troubleshooting rapido

- Verifica container:
```bash
docker compose ps
```
- Segui log:
```bash
docker compose logs -f backend frontend
```
- Recreate completo:
```bash
docker compose down
docker compose up -d
```
- Se DB schema non allineato, riesegui init DB:
```bash
docker compose run --rm db-init
```
