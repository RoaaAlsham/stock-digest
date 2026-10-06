export type ApiConfig = {
  db: D1Database;
  apiKey: string | undefined;
};

export function readConfig(env: Env): ApiConfig {
  const apiKey = env.API_KEY;
  return {
    db: env.DB,
    apiKey: typeof apiKey === "string" && apiKey.length > 0 ? apiKey : undefined,
  };
}
