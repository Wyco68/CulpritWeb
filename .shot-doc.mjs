import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const [input, outDir, prefix] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 794, height: 1123 } });
await p.goto(pathToFileURL(resolve(input)).href, { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
const figs = await p.$$('figure');
for (let i = 0; i < figs.length; i++) {
  await figs[i].screenshot({ path: `${outDir}/${prefix}${i + 1}.png` });
}
console.log('figures:', figs.length);
await b.close();
