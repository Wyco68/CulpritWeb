import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const [input, output, footerTitle] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(resolve(input)).href, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.pdf({
  path: output, format: 'A4', printBackground: true, displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate:
    '<div style="width:100%;font-size:7pt;color:hsl(220 9% 42%);font-family:Segoe UI,Arial,sans-serif;padding:0 15mm;display:flex;justify-content:space-between;border-top:1px solid hsl(214 18% 90%);padding-top:4px;">' +
    '<span>' + footerTitle + '</span>' +
    '<span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
  margin: { top: '18mm', bottom: '20mm', left: '15mm', right: '15mm' },
});
await browser.close();
console.log('rendered ' + output);
