import { InvalidCredentialsError, describeHashFormat } from "../domain/InvalidCredentialsError";
import type { UserRepository } from "./ports/UserRepository";
import type { PasswordHasher } from "./ports/PasswordHasher";
import type { TokenService } from "./ports/TokenService";
import { judgeSessionHoursFromEnv, nowSeconds, refreshCapFor } from "../domain/judgeSession";
import { findUserByIdentifier } from "./findUserByIdentifier";

export class LoginWithPassword {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly judgeSessionHours = judgeSessionHoursFromEnv()
  ) {}
  /** `email` carries an email or a username (see findUserByIdentifier). */
  async execute(input: { email: string; password: string }) {
    const user = await findUserByIdentifier(this.users, input.email);
    if (!user) {
      await this.hasher.hash(input.password); // equalize timing with the existing-user path
      throw new InvalidCredentialsError("user_not_found");
    }
    const ok = await this.hasher.verify(input.password, user.passwordHash);
    // Disabled accounts are indistinguishable from wrong credentials.
    if (!ok) throw new InvalidCredentialsError("wrong_password", describeHashFormat(user.passwordHash));
    if (!user.canLogin()) throw new InvalidCredentialsError("account_disabled");
    const access = await this.tokens.signAccess({ sub: user.id, email: user.email.value, role: user.role });
    const sessionStart = nowSeconds();
    const refresh = await this.tokens.signRefresh(
      { sub: user.id, email: user.email.value, role: user.role, sst: sessionStart },
      refreshCapFor(user.role, sessionStart, this.judgeSessionHours)
    );
    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresIn: access.expiresIn,
      role: user.role
    };
  }
}
