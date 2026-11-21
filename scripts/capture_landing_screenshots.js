import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

async function captureScreenshots() {
  console.log('=== [SELF-REVIEW] Capturing Landing Page Multi-Device Screenshots ===');

  const screenshotsDir = path.resolve('tests/screenshots/landing');
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const viewports = [
    { name: 'desktop_1440', width: 1440, height: 900, isMobile: false },
    { name: 'tablet_820', width: 820, height: 1180, isMobile: false },
    { name: 'mobile_390', width: 390, height: 844, isMobile: true }
  ];

  const results = {};

  for (const vp of viewports) {
    console.log(`\n--- Capturing viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile
    });

    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', err => {
      pageErrors.push(err.message);
      console.error(`[${vp.name} PageError]`, err.message);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.error(`[${vp.name} ConsoleError]`, msg.text());
      }
    });

    // Make sure unauthenticated by clearing cookies
    await context.clearCookies();

    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Save full page screenshot
    const screenshotFile = path.join(screenshotsDir, `${vp.name}.png`);
    await page.screenshot({ path: screenshotFile, fullPage: true });
    console.log(`Saved screenshot: ${screenshotFile}`);

    // Verify sections present on landing page
    const sections = await page.evaluate(() => {
      const hero = Boolean(document.querySelector('h1'));
      const arrive = Boolean(document.getElementById('arrive'));
      const scan = Boolean(document.getElementById('scan'));
      const verdict = Boolean(document.getElementById('verdict'));
      const autopilot = Boolean(document.getElementById('autopilot'));
      const hackLab = Boolean(document.getElementById('hack-lab'));
      const connectBtn = Array.from(document.querySelectorAll('button')).some(b => 
        b.textContent.includes('Connect with Google') || b.textContent.includes('Connect Gmail')
      );
      return { hero, arrive, scan, verdict, autopilot, hackLab, connectBtn };
    });

    results[vp.name] = {
      screenshot: screenshotFile,
      pageErrors,
      consoleErrors,
      sections,
      passed: pageErrors.length === 0 && sections.hero && sections.scan && sections.verdict && sections.autopilot
    };

    console.log(`Sections verified for ${vp.name}:`, sections);
    await context.close();
  }

  await browser.close();

  console.log('\n=== MULTI-DEVICE SCREENSHOTS SUMMARY ===');
  Object.keys(results).forEach(k => {
    console.log(`- ${k}: ${results[k].passed ? 'PASS ✅' : 'FAIL ❌'} (Errors: ${results[k].pageErrors.length})`);
  });

  fs.writeFileSync('tests/landing_review_report.json', JSON.stringify(results, null, 2));
  console.log('Report saved to tests/landing_review_report.json');
}

captureScreenshots().catch(err => {
  console.error('Self-review capture error:', err);
  process.exit(1);
});
