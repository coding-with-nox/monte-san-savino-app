# Architecture (high level)

- DDD layering: domain / application / infra
- Auth: email+password, JWT
- RBAC order: user < staff < judge < manager < admin
- Tenancy: DB per tenant (scaffolded; tenant middleware picks tenant_db_1 for now)
- Storage: MinIO (dev), S3 (prod)
- Kubernetes: stateless API & SPA; external Postgres/MinIO recommended
