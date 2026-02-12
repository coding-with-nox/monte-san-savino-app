# Deploy Stage su GCP

Questa guida descrive il deploy dell'app in ambiente `stage` su GKE usando i chart in `helm/`.

## Prerequisiti

- Progetto GCP attivo (`PROJECT_ID`).
- Cluster GKE esistente (es. `CLUSTER_NAME` in `REGION`).
- Artifact Registry Docker repository (es. `stage-apps`).
- `gcloud`, `kubectl`, `helm` installati localmente.
- Database PostgreSQL raggiungibile dal cluster (Cloud SQL o equivalente).
- Storage S3-compatibile raggiungibile dal cluster (MinIO o equivalente).

## 1. Autenticazione GCP

```bash
gcloud auth login
gcloud config set project <PROJECT_ID>
gcloud auth configure-docker <REGION>-docker.pkg.dev
```

## 2. Build e push immagini

Imposta il tag (consigliato SHA commit):

```bash
TAG=$(git rev-parse --short HEAD)
REGION=<REGION>
PROJECT_ID=<PROJECT_ID>
REPO=stage-apps
```

Backend:

```bash
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/miniatures-backend:${TAG} backend
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/miniatures-backend:${TAG}
```

Frontend:

```bash
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/miniatures-frontend:${TAG} frontend
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/miniatures-frontend:${TAG}
```

## 3. Connessione cluster e namespace

```bash
gcloud container clusters get-credentials <CLUSTER_NAME> --region <REGION>
kubectl create namespace stage --dry-run=client -o yaml | kubectl apply -f -
```

## 4. Values stage Helm

Crea `helm/backend/values-stage.yaml`:

```yaml
replicaCount: 2
image:
  repository: <REGION>-docker.pkg.dev/<PROJECT_ID>/stage-apps/miniatures-backend
  tag: "<TAG>"
  pullPolicy: IfNotPresent
service:
  type: ClusterIP
  port: 80
  targetPort: 3000
env:
  PORT: "3000"
  PG_HOST: "<postgres-host>"
  PG_PORT: "5432"
  PG_DB: "tenant_db_1"
  PG_USER: "<postgres-user>"
  MINIO_ENDPOINT: "<minio-host>"
  MINIO_PORT: "9000"
  MINIO_BUCKET: "models"
  MINIO_PUBLIC_URL: "https://<minio-public-url>"
secrets:
  JWT_SECRET: "<jwt-secret-stage>"
  PG_PASSWORD: "<postgres-password>"
  MINIO_ACCESS_KEY: "<minio-access-key>"
  MINIO_SECRET_KEY: "<minio-secret-key>"
ingress:
  enabled: true
  className: "gce"
  hosts:
    - host: api-stage.example.com
      paths:
        - path: /
          pathType: Prefix
```

Crea `helm/frontend/values-stage.yaml`:

```yaml
replicaCount: 2
image:
  repository: <REGION>-docker.pkg.dev/<PROJECT_ID>/stage-apps/miniatures-frontend
  tag: "<TAG>"
  pullPolicy: IfNotPresent
service:
  type: ClusterIP
  port: 80
ingress:
  enabled: true
  className: "gce"
  hosts:
    - host: app-stage.example.com
      paths:
        - path: /
          pathType: Prefix
```

## 5. Deploy Helm

```bash
helm upgrade --install miniatures-backend ./helm/backend -n stage -f helm/backend/values-stage.yaml
helm upgrade --install miniatures-frontend ./helm/frontend -n stage -f helm/frontend/values-stage.yaml
```

## 6. Verifiche post deploy

```bash
kubectl get pods -n stage
kubectl get svc -n stage
kubectl get ingress -n stage
```

Smoke test backend:

```bash
curl -i https://api-stage.example.com/health
```

Verifica frontend:

- Apri `https://app-stage.example.com`
- Esegui login e test rapido di:
  - pagina Utenti (toggle attivo/non attivo)
  - pagina Judge (voto e storico)
  - pagina Team (aggiunta membro via email)

## 7. Rollback

```bash
helm rollback miniatures-backend -n stage <REVISION>
helm rollback miniatures-frontend -n stage <REVISION>
```

Per vedere le revisioni:

```bash
helm history miniatures-backend -n stage
helm history miniatures-frontend -n stage
```
