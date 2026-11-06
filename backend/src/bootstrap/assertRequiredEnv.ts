import { requireJwtSecret } from "../identity/infra/tokens/jwtTokenService";
import { assertProductionSecrets } from "../shared/infra/config/productionEnv";

/**
 * Fails fast at startup when mandatory configuration is missing or insecure.
 * Error messages name the variable only, never its value.
 * Production (NODE_ENV=production) additionally requires PG_PASSWORD,
 * MINIO_ACCESS_KEY and MINIO_SECRET_KEY, and rejects the well-known defaults.
 */
export function assertRequiredEnv(env: NodeJS.ProcessEnv = process.env): void {
  requireJwtSecret(env);
  assertProductionSecrets(env);
}
