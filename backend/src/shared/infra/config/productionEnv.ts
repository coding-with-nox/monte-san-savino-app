/**
 * Known default credentials that must never be used in production.
 * Messages name the variable only, never its value.
 */
const WEAK_VALUES: Record<string, string> = {
  PG_PASSWORD: "postgres",
  MINIO_ACCESS_KEY: "minioadmin",
  MINIO_SECRET_KEY: "minioadmin"
};

export function isProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production";
}

/** Returns one problem description per missing/weak secret (empty outside production). */
export function productionSecretProblems(env: NodeJS.ProcessEnv = process.env, names: string[] = Object.keys(WEAK_VALUES)): string[] {
  if (!isProduction(env)) return [];
  const problems: string[] = [];
  for (const name of names) {
    const weak = WEAK_VALUES[name];
    const value = env[name];
    if (value === undefined || value.trim() === "") problems.push(`${name} is required in production`);
    else if (value === weak) problems.push(`${name} must not use the well-known default value in production`);
  }
  return problems;
}

export function assertProductionSecrets(env: NodeJS.ProcessEnv = process.env, names?: string[]): void {
  const problems = productionSecretProblems(env, names);
  if (problems.length) throw new Error(`Insecure production configuration: ${problems.join("; ")}`);
}
