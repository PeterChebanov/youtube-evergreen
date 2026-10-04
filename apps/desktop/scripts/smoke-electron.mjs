/* Starts the real Electron app against a fixture API (no database, no external calls) and checks
   that the window opens with minWidth 1100, the preload passes the API URL and the UI talks to it.
   Usage: pnpm build && node scripts/smoke-electron.mjs */
import { _electron as electron } from 'playwright';
import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { respond } from './layout-fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));

const api = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE' };
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  if (url.pathname === '/health') return res.writeHead(200, cors).end('{"status":"ok"}');
  const found = respond(req.method, url.pathname, url.searchParams);
  res.writeHead(found ? found[0] : 404, { ...cors, 'content-type': 'application/json' }).end(JSON.stringify(found ? found[1] : { message: 'no fixture' }));
});
await new Promise((ok) => api.listen(0, '127.0.0.1', ok));
const apiUrl = `http://127.0.0.1:${api.address().port}`;

const app = await electron.launch({ args: [resolve(here, '..')], env: { ...process.env, EVERGREEN_API_URL: apiUrl } });
const failures = [];
try {
  const win = await app.firstWindow();
  await win.waitForSelector('.statusbar');
  const bridged = await win.evaluate(() => window.evergreen?.apiUrl);
  if (bridged !== apiUrl) failures.push(`preload apiUrl is ${bridged}, expected ${apiUrl}`);
  const minWidth = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getMinimumSize()[0]);
  if (minWidth !== 1100) failures.push(`minWidth is ${minWidth}`);
  await win.waitForFunction(() => document.querySelector('.statusbar')?.textContent?.includes('API connected'), null, { timeout: 10_000 }).catch(() => failures.push('status bar never showed "API connected"'));
  await win.waitForSelector('[data-screen="research"] tbody tr', { timeout: 10_000 }).catch(() => failures.push('research table stayed empty'));
  await win.screenshot({ path: resolve(here, '..', 'shots', 'electron-smoke.png') });
} finally {
  await app.close();
  api.close();
}
console.log(failures.length ? `FAIL\n  ${failures.join('\n  ')}` : 'ELECTRON OK: window, preload bridge, minWidth 1100 and API calls work');
process.exit(failures.length ? 1 : 0);
