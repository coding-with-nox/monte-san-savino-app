import { Email } from "./Email";
import type { Role } from "./Role";

export class User {
  constructor(
    public readonly id: string,
    public email: Email,
    public role: Role,
    public passwordHash: string,
    public isActive: boolean = true,
    public tenantId?: string | null,
    public username: string | null = null,
    /** Sessions started before this instant are revoked (password reset). */
    public sessionsRevokedAt: Date | null = null
  ) {}
  canLogin(): boolean { return this.isActive; }
  /** `sessionStart` in epoch seconds. A session started in the revocation second itself is revoked too (safe side). */
  isSessionRevoked(sessionStart: number): boolean {
    return this.sessionsRevokedAt !== null && sessionStart <= Math.floor(this.sessionsRevokedAt.getTime() / 1000);
  }
}
