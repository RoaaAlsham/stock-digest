export type WorkerConfig = {
  baseUrl: string;
  serviceKey: string;
  hmacSecret: string;
  digestTo: string;
  runSecret: string | undefined;
};

function nonempty(value: string | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function readConfig(env: Env): WorkerConfig {
  const baseUrl = env.AUTHDEEP_BASE_URL.replace(/\/+$/, "");
  return {
    baseUrl,
    serviceKey: env.AUTHDEEP_SERVICE_KEY,
    hmacSecret: env.AUTHDEEP_HMAC_SECRET,
    digestTo: env.AUTHDEEP_DIGEST_TO,
    runSecret: nonempty(env.RUN_SECRET),
  };
}

export function configReady(config: WorkerConfig): boolean {
  return Boolean(
    config.runSecret &&
      config.baseUrl &&
      config.serviceKey &&
      config.hmacSecret &&
      config.digestTo,
  );
}
