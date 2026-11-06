import type { UserRepository } from "./ports/UserRepository";
import type { TokenService } from "./ports/TokenService";

/**
 * Exchanges a refresh token for a new token pair, re-reading the user from the DB so that
 * deleted/deactivated users are rejected and the role always reflects the current DB value.
 * Every failure yields the same generic error.
 */
export class RefreshSession {
  constructor(private readonly users: UserRepository, private readonly tokens: TokenService) {}

  async execute(refreshToken: string) {
    let payload: any;
    try {
      payload = await this.tokens.verify(refreshToken);
    } catch {
      throw new Error("Invalid refresh token");
    }
    if (payload.tokenType !== "refresh" || typeof payload.sub !== "string") throw new Error("Invalid refresh token");
    const user = await this.users.findById(payload.sub);
    if (!user || !user.canLogin()) throw new Error("Invalid refresh token");
    const claims = {
      sub: user.id,
      email: user.email.value,
      role: user.role,
      tenantId: (payload.tenantId as string | undefined) ?? undefined
    };
    const access = await this.tokens.signAccess(claims);
    const refresh = await this.tokens.signRefresh(claims);
    return { accessToken: access.token, refreshToken: refresh.token, expiresIn: access.expiresIn, role: user.role };
  }
}
