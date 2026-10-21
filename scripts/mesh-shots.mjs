// Dev tool: screenshots meshes from /mesh-preview.html for visual review.
//   node scripts/mesh-shots.mjs <outDir> <name>[:<az>[:<el>[:<dist>[:<loadoutId>]]]] ...   (name = kyle | env | archetype id)
// Needs `npx vite --port 5199` running. Add `game` as a name suffix (e.g. kyle:game) for the in-game camera.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const [outDir, ...specs] = process.argv.slice(2);
if (!outDir || specs.length === 0) {
  console.error('usage: node scripts/mesh-shots.mjs <outDir> <name[:az[:el[:dist]]]> ...');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
});
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
page.on('pageerror', (e) => console.error('pageerror:', e.message));

for (const spec of specs) {
  const [name, az, el, dist, loadout] = spec.split(':');
  const q = new URLSearchParams({ m: name });
  if (loadout) q.set('loadout', loadout);
  if (az === 'game') q.set('game', '1');
  else {
    if (az) q.set('az', az);
    if (el) q.set('el', el);
    if (dist) q.set('dist', dist);
  }
  await page.goto(`http://localhost:5199/mesh-preview.html?${q}`);
  await page.waitForFunction(() => window.__PREVIEW_READY__ === true, null, { timeout: 20000 });
  const file = path.join(outDir, `${spec.replace(/[:]/g, '_')}.png`);
  await page.screenshot({ path: file });
  console.log('wrote', file);
}
await browser.close();
