import fs from 'node:fs';
import path from 'node:path';

const distAssetsDir = path.resolve('dist', 'assets');
if (!fs.existsSync(distAssetsDir)) {
  console.error('[bundle-check] Error: dist/assets directory not found. Run "npm run build" first.');
  process.exit(1);
}

const args = process.argv.slice(2);
let maxKb = 450; // P10-02 target < 450 KB
const maxKbIdx = args.indexOf('--max-kb');
if (maxKbIdx !== -1 && args[maxKbIdx + 1]) {
  maxKb = parseFloat(args[maxKbIdx + 1]);
}

const files = fs.readdirSync(distAssetsDir);
const jsFiles = files.filter((f) => f.endsWith('.js'));
const mainChunk = jsFiles.find((f) => f.startsWith('index-')) || jsFiles[0];

if (!mainChunk) {
  console.error('[bundle-check] Error: No main JS bundle found in dist/assets.');
  process.exit(1);
}

const stats = fs.statSync(path.join(distAssetsDir, mainChunk));
const sizeKb = stats.size / 1024;

console.log(`[bundle-check] Main JS bundle (${mainChunk}): ${sizeKb.toFixed(2)} KB (budget: ${maxKb} KB)`);

if (sizeKb > maxKb) {
  console.error(`[bundle-check] FAILED: Main JS bundle exceeds budget of ${maxKb} KB by ${(sizeKb - maxKb).toFixed(2)} KB!`);
  process.exit(1);
}

console.log(`[bundle-check] PASSED: Bundle size within budget.`);
