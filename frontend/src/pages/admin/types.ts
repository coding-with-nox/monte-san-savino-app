export type AdminEvent = { id: string; name: string; status: string };
export type AdminCategory = { id: string; eventId: string; name: string; status: string; freeToEnter?: boolean };
export type AdminUser = { id: string; email: string; role: string; isActive: boolean };
export type ModelRef = { id: string; name: string; categoryId?: string };
