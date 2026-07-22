import type { ResolveConfigFn } from '@microlabs/otel-cf-workers';

export type OtelBindings = {
  OBSERVABILITY_ENABLED?: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  GRAFANA_CLOUD_INSTANCE_ID?: string;
  GRAFANA_CLOUD_API_KEY?: string;
  LOG_LEVEL?: string;
};

export const resolveOtelConfig: ResolveConfigFn = (env: OtelBindings) => {
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

  const headers: Record<string, string> = {};
  if (env.GRAFANA_CLOUD_INSTANCE_ID && env.GRAFANA_CLOUD_API_KEY) {
    headers['Authorization'] =
      `Basic ${btoa(`${env.GRAFANA_CLOUD_INSTANCE_ID}:${env.GRAFANA_CLOUD_API_KEY}`)}`;
  }

  // Store log level so logger.ts can read it without env access
  if (env.LOG_LEVEL) {
    (globalThis as Record<string, unknown>).__logLevel = env.LOG_LEVEL;
  }

  return {
    exporter: {
      url: `${endpoint}/v1/traces`,
      headers,
    },
    logExporter: {
      url: `${endpoint}/v1/logs`,
      headers,
    },
    service: {
      name: 'meterly-api',
      version: '1.0.0',
    },
    // Intercept console.log/error calls and forward as OTLP logs
    logs: {
      enabled: true,
    },
  };
};
