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
    public username: string | null = null
  ) {}
  canLogin(): boolean { return this.isActive; }
}
