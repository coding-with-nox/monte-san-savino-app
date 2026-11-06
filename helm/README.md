# Helm charts

- `helm/backend` deploys the API
- `helm/frontend` deploys the SPA

Provide your own images and enable Ingress as needed.

Backend secrets have no defaults: `helm install`/`template` fails unless these are provided
(`--set` or a private values file kept out of git):

- `secrets.JWT_SECRET` (`openssl rand -base64 48`)
- `secrets.PG_PASSWORD`
- `secrets.MINIO_ACCESS_KEY`, `secrets.MINIO_SECRET_KEY`

Existing releases that relied on the old defaults (`postgres` / `minioadmin`) must pass the values
currently in use, otherwise the upgrade fails (or, if changed, the backend can no longer reach the DB/MinIO).
Image tags default to `latest`: pin `image.tag` to a released version.
