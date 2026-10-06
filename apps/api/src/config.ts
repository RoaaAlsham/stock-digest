export type ApiConfig = {
  db: D1Database;
  gatewayKey: string | undefined;
  serviceSecret: string | undefined;
};

function nonempty(value: string | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function readConfig(env: Env): ApiConfig {
  return {
    db: env.DB,
    gatewayKey: nonempty(env.AUTHDEEP_GATEWAY_KEY),
    serviceSecret: nonempty(env.AUTHDEEP_SERVICE_SECRET),
  };
}
