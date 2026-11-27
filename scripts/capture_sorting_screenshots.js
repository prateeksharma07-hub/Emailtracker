import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const artifactDir = 'C:/Users/jarvi/.gemini/antigravity/brain/f954be48-8e63-4922-bce4-0126a4d5ee14';
  const outDir = path.resolve(artifactDir);
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const viewports = [
    { name: 'desktop_1440', width: 1440, height: 900 },
    { name: 'tablet_820', width: 820, height: 1180 },
    { name: 'mobile_390', width: 390, height: 844 }
  ];

  const themes = ['night', 'day'];

  console.log('=== Capturing Sorting Room Screenshots ===');

  for (const theme of themes) {
    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.name === 'mobile_390',
        hasTouch: vp.name === 'mobile_390'
      });

      const page = await context.newPage();

      // Set initial theme in localStorage before loading
      await page.addInitScript((th) => {
        localStorage.setItem('mailmind-sorting-theme', th);
        localStorage.setItem('mailmind-theme', th === 'night' ? 'dark' : 'light');
      }, theme);

      // 1. Landing Page Screenshot
      await page.goto('http://localhost:5176/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1000);

      // Above-the-fold Landing Viewport
      const atfPath = path.join(outDir, `sorting_atf_${vp.name}_${theme}.png`);
      await page.screenshot({ path: atfPath, fullPage: false });
      console.log(`Captured above-the-fold: ${atfPath}`);

      // Full Landing Page
      const landingPath = path.join(outDir, `sorting_landing_${vp.name}_${theme}.png`);
      await page.screenshot({ path: landingPath, fullPage: true });
      console.log(`Captured full landing: ${landingPath}`);

      // 2. Design Showcase Screenshot
      await page.goto('http://localhost:5176/#design', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1000);

      const designPath = path.join(outDir, `sorting_design_${vp.name}_${theme}.png`);
      await page.screenshot({ path: designPath, fullPage: true });
      console.log(`Captured design showcase: ${designPath}`);

      await context.close();
    }
  }

  await browser.close();
  console.log('=== All screenshots successfully captured! ===');
}

main().catch(err => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
