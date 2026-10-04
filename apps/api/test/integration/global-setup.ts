import { PrismaClient } from '@prisma/client';
import { exec as execCallback } from 'node:child_process';
import IORedis from 'ioredis';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PGLITE_PORT, testDatabaseUrl, testRedisUrl } from './env';
import { startPgliteServer } from './pglite-db';

const exec = promisify(execCallback);
type Stop = () => Promise<void>;
const holder = globalThis as typeof globalThis & { __stopTestDb?: Stop };

/**
 * Prepares an isolated database (TEST_DB=pglite: in-memory Postgres; otherwise TEST_DATABASE_URL,
 * created if missing), applies migrations and empties the test Redis db.
 */
export default async function globalSetup() {
  if (process.env.TEST_DB === 'pglite') {
    const server = await startPgliteServer(PGLITE_PORT);
    process.env.TEST_DATABASE_URL = server.url;
    holder.__stopTestDb = server.stop;
  } else {
    await createDatabaseIfMissing(testDatabaseUrl());
  }
  // Async on purpose: the in-memory server lives in this process and must keep serving.
  await exec('npx prisma migrate deploy', {
    cwd: join(__dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
  });
  const redis = new IORedis(testRedisUrl());
  await redis.flushdb();
  await redis.quit();
}

export async function stopTestDb() {
  await holder.__stopTestDb?.();
}

async function createDatabaseIfMissing(databaseUrl: string) {
  const dbName = new URL(databaseUrl).pathname.slice(1);
  const admin = new URL(databaseUrl);
  admin.pathname = '/postgres';
  const prisma = new PrismaClient({ datasourceUrl: admin.toString() });
  try {
    const exists = await prisma.$queryRaw<unknown[]>`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
    if (!exists.length) await prisma.$executeRawUnsafe(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
  } finally {
    await prisma.$disconnect();
  }
}
