import { roleRank, ROLES, type Role } from "./Role";

export type PolicyResult = { ok: true } | { ok: false; error: string };
const OK: PolicyResult = { ok: true };
const deny = (error: string): PolicyResult => ({ ok: false, error });

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Admin may manage anyone; everybody else only roles strictly below their own. */
function canManageRole(actor: Role, target: Role): boolean {
  return actor === "admin" || roleRank(target) < roleRank(actor);
}

export function authorizeCreateUser(actorRole: Role, newRole: Role): PolicyResult {
  if (!canManageRole(actorRole, newRole)) {
    return deny(`Cannot create a user with role '${newRole}': only roles strictly below your own (${actorRole}) can be assigned`);
  }
  return OK;
}

export function authorizeUpdateUser(params: {
  actorId: string;
  actorRole: Role;
  targetId: string;
  targetRole: Role;
  newRole?: Role;
  newIsActive?: boolean;
}): PolicyResult {
  const { actorId, actorRole, targetId, targetRole, newRole, newIsActive } = params;
  const self = actorId === targetId;
  if (self && newRole !== undefined && newRole !== targetRole) return deny("You cannot change your own role");
  if (self && newIsActive === false) return deny("You cannot deactivate yourself");
  if (!canManageRole(actorRole, targetRole)) {
    return deny(`Cannot modify a user with role '${targetRole}': only users with a role strictly below your own (${actorRole}) can be modified`);
  }
  if (newRole !== undefined && !canManageRole(actorRole, newRole)) {
    return deny(`Cannot assign role '${newRole}': only roles strictly below your own (${actorRole}) can be assigned`);
  }
  return OK;
}

export function authorizeResetPassword(params: {
  actorId: string;
  actorRole: Role;
  targetId: string;
  targetRole: Role;
}): PolicyResult {
  if (!canManageRole(params.actorRole, params.targetRole)) {
    return deny(`Cannot reset the password of a user with role '${params.targetRole}'`);
  }
  return OK;
}
