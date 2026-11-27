import type { UserRepository } from "./ports/UserRepository";
import type { TokenService } from "./ports/TokenService";
import { isJudgeSessionOver, judgeSessionHoursFromEnv, nowSeconds, refreshCapFor, sessionStartOf, JUDGE_ROLE } from "../domain/judgeSession";

/**
 * Exchanges a refresh token for a new token pair, re-reading the user from the DB so that
 * deleted/deactivated users are rejected and the role always reflects the current DB value.
 * Judges (current DB role) cannot refresh after JUDGE_SESSION_HOURS from login: they must log in again.
 * Every failure yields the same generic error.
 */
export class RefreshSession {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: TokenService,
    private readonly judgeSessionHours = judgeSessionHoursFromEnv()
  ) {}

  async execute(refreshToken: string) {
    let payload: any;
    try {
      payload = await this.tokens.verify(refreshToken);
    } catch {
      throw new Error("Invalid refresh token");
    }
    if (payload.tokenType !== "refresh" || typeof payload.sub !== "string") throw new Error("Invalid refresh token");
    // Tokens issued before `sst` existed have no session start: their issue time is used instead.
    const sessionStart = sessionStartOf(payload);
    if (sessionStart === undefined) throw new Error("Invalid refresh token");
    const user = await this.users.findById(payload.sub);
    if (!user || !user.canLogin()) throw new Error("Invalid refresh token");
    // Password reset (by the user or an admin) ends every session started before it.
    if (user.isSessionRevoked(sessionStart)) throw new Error("Invalid refresh token");
    if (user.role === JUDGE_ROLE && isJudgeSessionOver(sessionStart, this.judgeSessionHours, nowSeconds())) {
      throw new Error("Invalid refresh token");
    }
    const claims = {
      sub: user.id,
      email: user.email.value,
      role: user.role,
      tenantId: (payload.tenantId as string | undefined) ?? undefined
    };
    const access = await this.tokens.signAccess(claims);
    const refresh = await this.tokens.signRefresh(
      { ...claims, sst: sessionStart },
      refreshCapFor(user.role, sessionStart, this.judgeSessionHours)
    );
    return { accessToken: access.token, refreshToken: refresh.token, expiresIn: access.expiresIn, role: user.role };
  }
}
