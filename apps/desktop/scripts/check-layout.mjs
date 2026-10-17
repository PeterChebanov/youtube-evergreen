/* Layout check of the real app (evergreen-studio-ui/check-layout.js pointed at this UI).
   Usage: node scripts/check-layout.mjs [--live http://localhost:3000]
   Default: the built UI with fixture API data that includes 60+ character unbroken strings.
   --live: the built UI against a running API. Fails on any overflow; writes screenshots to ./shots. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { respond } from './layout-fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(here, '..', 'dist', 'browser');
const UI_PACKAGE = resolve(here, '..', '..', '..', 'evergreen-studio-ui');
const SHOTS = resolve(here, '..', 'shots');
const SCREENS = ['research', 'advice', 'plan', 'facts', 'writer', 'subtitles', 'database', 'videos'];
const WIDTHS = [1100, 1280, 1600];
const THEMES = ['light', 'dark'];
const FIXTURE_API = 'http://api.fixture';

const liveIndex = process.argv.indexOf('--live');
const apiUrl = liveIndex > 0 ? process.argv[liveIndex + 1] ?? 'http://localhost:3000' : FIXTURE_API;

/** Puts each screen into its data-filled state, the way an author would. */
const PREPARE = {
  advice: async (page) => {
    await page.getByRole('button', { name: 'Get 3 topics' }).click();
    await page.waitForSelector('[data-screen="advice"] .advice-acc-topic');
  },
  subtitles: async (page) => {
    await page.fill('#subs-url', 'https://www.youtube.com/watch?v=abcdefghijk');
    await page.getByRole('button', { name: 'Check video' }).click();
    await page.waitForSelector('[data-screen="subtitles"] .kv');
  },
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain' };

function serve() {
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    try {
      const body = await readFile(join(DIST, path === '/' ? 'index.html' : path));
      res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'text/html' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

const server = await serve();
const appUrl = `http://127.0.0.1:${server.address().port}/?api=${encodeURIComponent(apiUrl)}`;
const check = await readFile(join(UI_PACKAGE, 'overflow-check.js'), 'utf8');
await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch();
let failures = 0;

for (const theme of THEMES) {
  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 800 } });
    page.on('pageerror', (e) => {
      failures++;
      console.log(`FAIL ${theme} ${w} page error: ${e.message}`);
    });
    if (apiUrl === FIXTURE_API) {
      await page.addInitScript(() => localStorage.setItem('evergreen.projectId', 'p1'));
      await page.route(`${FIXTURE_API}/**`, async (route) => {
        const url = new URL(route.request().url());
        const found = respond(route.request().method(), url.pathname, url.searchParams);
        await route.fulfill(found ? { status: found[0], json: found[1] } : { status: 404, json: { message: `no fixture for ${url.pathname}` } });
      });
    }
    await page.goto(`${appUrl}#research`);
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await page.evaluate(check);
    for (const s of SCREENS) {
      await page.evaluate((id) => {
        location.hash = id;
        document.querySelector(`.tab[data-screen="${id}"]`).click();
      }, s);
      await page.waitForSelector(`.screen[data-screen="${s}"]`);
      await settle(page);
      if (PREPARE[s]) {
        await PREPARE[s](page);
        await settle(page);
      }
      const issues = await page.evaluate(() => window.__checkOverflow());
      if (issues.length) {
        failures += issues.length;
        console.log(`FAIL ${theme} ${w} ${s}`);
        issues.forEach((i) => console.log('   ' + i));
      }
      if (s === 'research' || s === 'subtitles') {
        const label = s === 'research' ? 'Research all period' : 'Check video';
        const btn = page.getByRole('button', { name: label, exact: true });
        if (await btn.count()) {
          const clipped = await btn.evaluate(
            (el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
          );
          if (clipped) {
            failures++;
            console.log(`FAIL ${theme} ${w} ${s}: primary button "${label}" text is clipped`);
          }
        }
      }
      if (theme === 'light' || w === 1100) await page.screenshot({ path: join(SHOTS, `${s}-${theme}-${w}.png`) });
    }
    await page.close();
  }
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} problem(s)` : 'ALL CLEAR: no overflow in 8 screens x 3 widths x 2 themes');
process.exit(failures ? 1 : 0);
