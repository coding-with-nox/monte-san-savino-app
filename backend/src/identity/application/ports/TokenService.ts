export interface TokenService {
  sign(payload: { sub: string; email: string; role: string; tenantId?: string }): Promise<string>;
  verify(token: string): Promise<any>;
}
