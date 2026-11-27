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

## 9. HTTPS (obbligatorio su internet)

Un server raggiungibile da internet deve usare HTTPS: in HTTP password, token e dati personali viaggiano in chiaro. Il repo include Caddy, che ottiene e rinnova da solo i certificati Let's Encrypt.

1. DNS: due nomi verso il server, uno per l'app e uno per le immagini dei modelli (le immagini caricate restano su un'origine separata dall'app). Esempio: `app.example.org` e `files.example.org`.
2. Firewall: aperte solo le porte `80` e `443`.
3. In `.env`:
   ```bash
   APP_DOMAIN=app.example.org
   FILES_DOMAIN=files.example.org
   ACME_EMAIL=admin@example.org
   ```
4. Avvio (Docker Compose 2.24 o successivo):
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
   ```

Cosa fa `docker-compose.tls.yml`:

- pubblica solo Caddy (`80`, `443`); nginx (`8080`) e MinIO (`9000`) non sono più pubblicati;
- reindirizza HTTP su HTTPS, aggiunge HSTS e porta la CSP sull'origine `https://FILES_DOMAIN` con `upgrade-insecure-requests`;
- imposta `PUBLIC_APP_URL` e `MINIO_PUBLIC_URL` in `https://`;
- crea il bucket delle immagini con lettura anonima (`minio-init`), perché le URL delle immagini sono pubbliche;
- nginx legge l'IP reale del client dall'header scritto da Caddy (solo dalle reti Docker), così i limiti di login valgono per il singolo client.

Verifica dopo l'avvio:

```bash
curl -I http://app.example.org        # 308 verso https
curl -I https://app.example.org       # Strict-Transport-Security presente
```

Con un proxy o un CDN con TLS già presente (per esempio Cloudflare), non serve Caddy: il proxy va puntato su `8080`, e `PUBLIC_APP_URL`, `MINIO_PUBLIC_URL` e le origini della CSP vanno impostati in `https://`. Va anche abilitato HSTS (`docker/nginx/security-headers.conf`).

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
