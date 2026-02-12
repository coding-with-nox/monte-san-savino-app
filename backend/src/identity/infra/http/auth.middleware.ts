import { Elysia } from "elysia";
import { JwtTokenService } from "../tokens/jwtTokenService";

export type AuthUser = { id: string; email: string; role: string; tenantId: any };

export const authMiddleware = new Elysia({ name: "auth" }).derive(async ({ headers }): Promise<{ user: AuthUser | null }> => {
  const auth = headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return { user: null };
  const token = auth.substring(7);
  try {
    const payload = await new JwtTokenService().verify(token);
    if (payload.tokenType && payload.tokenType !== "access") {
      return { user: null };
    }
    return { user: { id: payload.sub as string, email: payload.email as string, role: payload.role as string, tenantId: payload.tenantId as any } };
  } catch {
    return { user: null };
  }
}).as("scoped");
