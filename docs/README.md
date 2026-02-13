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
