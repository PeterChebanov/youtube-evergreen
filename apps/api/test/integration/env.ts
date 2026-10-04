export const DEFAULT_TEST_DATABASE_URL = 'postgresql://youtube_ai:youtube_ai@localhost:5432/youtube_ai_test?schema=public';
export const PGLITE_PORT = Number(process.env.TEST_PGLITE_PORT ?? 55433);

export const testDatabaseUrl = () => process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
export const testRedisUrl = () => process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/15';

Object.assign(process.env, {
  DATABASE_URL: testDatabaseUrl(),
  REDIS_URL: testRedisUrl(),
  LLM_PROVIDER: 'mock',
  YOUTUBE_API_KEY: '',
  SUBTITLES_PROVIDER: 'mock',
  TAVILY_API_KEY: '',
  BRAVE_API_KEY: '',
  REDDIT_CLIENT_ID: '',
  REDDIT_CLIENT_SECRET: '',
  YOUTUBE_DAILY_QUOTA_UNITS: '10000',
  YOUTUBE_QUOTA_RESERVE_UNITS: '200',
});
