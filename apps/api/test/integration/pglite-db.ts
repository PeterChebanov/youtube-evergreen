import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

/**
 * In-memory Postgres (WASM build with pgvector) behind the wire protocol.
 * Used by the integration suite when no Docker Postgres is available (TEST_DB=pglite).
 */
export async function startPgliteServer(port: number): Promise<{ url: string; stop: () => Promise<void> }> {
  const db = await PGlite.create({ extensions: { vector } });
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 20 });
  await server.start();
  return {
    url: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable&connection_limit=1`,
    stop: async () => {
      await server.stop();
      await db.close();
    },
  };
}
