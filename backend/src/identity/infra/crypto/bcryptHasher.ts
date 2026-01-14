import type { PasswordHasher } from "../../application/ports/PasswordHasher";
export class BcryptHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> { return await Bun.password.hash(plain); }
  async verify(plain: string, hash: string): Promise<boolean> { return await Bun.password.verify(plain, hash); }
}
