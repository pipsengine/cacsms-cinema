import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type LoadRootEnvOptions = {
  /** When true, values from `.env` replace existing process.env entries. */
  override?: boolean;
};

/** Load repo-root `.env` into process.env. */
export function loadRootEnv(options: LoadRootEnvOptions = {}): void {
  const { override = false } = options;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, '../../../.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env')
  ];
  const envPath = candidates.find((p) => existsSync(p));
  if (!envPath) return;

  for (const raw of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (override || process.env[key] === undefined) process.env[key] = value;
  }
}
