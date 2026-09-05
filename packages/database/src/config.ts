import type { config as SqlConfig } from 'mssql';

const required = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const asBoolean = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined ? fallback : value.toLowerCase() === 'true';

const asNumber = (value: string | undefined, fallback: number): number =>
  value ? Number(value) : fallback;

export function getSqlConfig(): SqlConfig {
  return {
    server: required('MSSQL_HOST', 'localhost'),
    port: asNumber(process.env.MSSQL_PORT, 1433),
    database: required('MSSQL_DATABASE', 'db_Cacsms-Cinema'),
    user: required('MSSQL_USER', 'cacsms'),
    password: required('MSSQL_PASSWORD'),
    pool: {
      max: asNumber(process.env.MSSQL_POOL_MAX, 20),
      min: asNumber(process.env.MSSQL_POOL_MIN, 0),
      idleTimeoutMillis: asNumber(process.env.MSSQL_POOL_IDLE_MS, 30000)
    },
    options: {
      encrypt: asBoolean(process.env.MSSQL_ENCRYPT, false),
      trustServerCertificate: asBoolean(process.env.MSSQL_TRUST_SERVER_CERTIFICATE, true),
      enableArithAbort: true
    }
  };
}
