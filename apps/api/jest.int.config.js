/**
 * Integration tests: need Redis and Postgres with pgvector, either Docker (pnpm docker:up, TEST_DATABASE_URL)
 * or the in-memory WASM Postgres (TEST_DB=pglite).
 */
/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'test/integration/.*\\.int-spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  globalSetup: '<rootDir>/test/integration/global-setup.ts',
  globalTeardown: '<rootDir>/test/integration/global-teardown.ts',
  setupFiles: ['<rootDir>/test/integration/env.ts'],
  testTimeout: 60000,
  maxWorkers: 1,
};
