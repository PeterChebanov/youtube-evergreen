/** Loads monorepo root `.env`, then runs `prisma` (Prisma CLI only reads `apps/api/.env` by default). */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootEnv = resolve(apiDir, '..', '..', '.env');

if (existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] ??= val;
  }
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node scripts/with-root-env.mjs <prisma-args…>');
  process.exit(1);
}

const r = spawnSync('npx', ['prisma', ...args], { cwd: apiDir, env: process.env, stdio: 'inherit' });
process.exit(r.status ?? 1);
