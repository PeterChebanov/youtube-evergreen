/* Usage: node check-layout.js   (needs playwright). Writes screenshots to ./shots and fails on any overflow. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SCREENS = ['research','advice','plan','facts','writer','subtitles','database','videos'];
const WIDTHS = [1100, 1280, 1600];
const THEMES = ['light', 'dark'];
(async () => {
  const browser = await chromium.launch();
  const url = 'file://' + path.resolve(__dirname, 'reference/index.html');
  const check = fs.readFileSync(path.resolve(__dirname, 'overflow-check.js'), 'utf8');
  fs.mkdirSync(path.resolve(__dirname, 'shots'), { recursive: true });
  let failures = 0;
  for (const theme of THEMES) for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 800 } });
    await page.goto(url);
    await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
    await page.evaluate(check);
    for (const s of SCREENS) {
      await page.evaluate(id => { location.hash = id; document.querySelector('.tab[data-screen="' + id + '"]').click(); }, s);
      const issues = await page.evaluate(() => window.__checkOverflow());
      if (issues.length) { failures += issues.length; console.log(`FAIL ${theme} ${w} ${s}`); issues.forEach(i => console.log('   ' + i)); }
      if (theme === 'light' || w === 1100) await page.screenshot({ path: path.resolve(__dirname, `shots/${s}-${theme}-${w}.png`), fullPage: false });
    }
    await page.close();
  }
  await browser.close();
  console.log(failures ? `\n${failures} problem(s)` : 'ALL CLEAR: no overflow in 8 screens x 3 widths x 2 themes');
  process.exit(failures ? 1 : 0);
})();
