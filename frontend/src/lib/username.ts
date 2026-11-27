/** Username rule, mirrored from the backend: 3–30 characters, letters, digits, '.', '_' or '-'. */
export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,30}$/;

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}
