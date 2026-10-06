export type WorkerConfig = {
  apiBaseUrl: string;
  apiKey: string;
  runSecret: string | undefined;
};

export function readConfig(env: Env): WorkerConfig {
  const runSecret = env.RUN_SECRET;
  return {
    apiBaseUrl: env.API_BASE_URL,
    apiKey: env.API_KEY,
    runSecret: typeof runSecret === "string" && runSecret.length > 0 ? runSecret : undefined,
  };
}
