import sql from 'mssql';
import { getSqlConfig } from './config.js';

let pool: sql.ConnectionPool | null = null;

export async function getDb(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return pool;
  pool = await new sql.ConnectionPool(getSqlConfig()).connect();
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

export { sql };
