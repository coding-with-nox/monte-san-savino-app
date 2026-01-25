export interface TokenService {
  signAccess(payload: { sub: string; email: string; role: string; tenantId?: string }): Promise<{ token: string; expiresIn: number }>;
  signRefresh(payload: { sub: string; email: string; role: string; tenantId?: string }): Promise<{ token: string; expiresIn: number }>;
  verify(token: string): Promise<any>;
}
