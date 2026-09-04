import sql from 'mssql';
import { getSqlConfig } from './config.js';

let pool: sql.ConnectionPool | null = null;
let connecting: Promise<sql.ConnectionPool> | null = null;

export async function getDb(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return pool;
  if (connecting) return connecting;
  connecting = (async () => {
    try {
      pool = await new sql.ConnectionPool(getSqlConfig()).connect();
      return pool;
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
  connecting = null;
}

export { sql };
