import { requireJwtSecret } from "../identity/infra/tokens/jwtTokenService";

/**
 * Fails fast at startup when mandatory configuration is missing.
 * Error messages name the variable only, never its value.
 */
export function assertRequiredEnv(): void {
  requireJwtSecret();
}
