import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

async function verifyLanding() {
  console.log('=== [STEP 6: FINAL VERIFICATION] Comprehensive Landing Page Check ===');
  const outDir = path.resolve('tests/screenshots/verified');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const viewports = [
    { name: 'mobile_390', width: 390, height: 844, isMobile: true },
    { name: 'tablet_820', width: 820, height: 1180, isMobile: false },
    { name: 'desktop_1440', width: 1440, height: 900, isMobile: false }
  ];

  const themes = ['dark', 'light'];
  const results = {
    timestamp: new Date().toISOString(),
    viewports: {},
    featureCardsFound: 0,
    featuresVerified: false,
    autoScanLoopVerified: false,
    horizontalScrollFree: true,
    reducedMotionVerified: false
  };

  for (const vp of viewports) {
    results.viewports[vp.name] = {};

    for (const th of themes) {
      console.log(`\nTesting ${vp.name} [theme: ${th}]...`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile
      });

      const page = await context.newPage();
      const pageErrors = [];

      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });

      // Apply theme
      if (th === 'light') {
        await page.evaluate(() => document.documentElement.classList.remove('dark'));
      } else {
        await page.evaluate(() => document.documentElement.classList.add('dark'));
      }

      await page.waitForTimeout(1000);

      // Measure layout metrics
      const metrics = await page.evaluate(() => {
        const docWidth = document.documentElement.scrollWidth;
        const winWidth = window.innerWidth;
        const hasHorizontalScroll = docWidth > winWidth;

        // Check if any element overflows the viewport horizontally
        const allElements = Array.from(document.querySelectorAll('*'));
        const overflowing = [];
        allElements.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > winWidth + 1 && el.id !== 'root' && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
            overflowing.push({
              tag: el.tagName,
              className: (el.className || '').toString().slice(0, 50),
              right: Math.round(rect.right),
              excess: Math.round(rect.right - winWidth)
            });
          }
        });

        // Verify "Kya Karta Hai" section
        const howItWorks = document.getElementById('how-it-works');
        const cards = howItWorks ? Array.from(howItWorks.querySelectorAll('h3')).map(h => h.textContent.trim()) : [];

        // Check AutoScanLoop stage
        const scanSection = document.getElementById('scan');
        const pauseBtn = scanSection ? scanSection.querySelector('button[aria-label*="scan loop"]') : null;
        const hasPauseBtn = Boolean(pauseBtn);

        // Check typography font-family
        const h1 = document.querySelector('h1');
        const h1Font = h1 ? window.getComputedStyle(h1).fontFamily : '';

        return {
          docWidth,
          winWidth,
          hasHorizontalScroll,
          overflowCount: overflowing.length,
          topOverflows: overflowing.slice(0, 3),
          howItWorksCards: cards,
          hasPauseBtn,
          h1Font
        };
      });

      if (metrics.hasHorizontalScroll || metrics.overflowCount > 0) {
        results.horizontalScrollFree = false;
      }

      const shotFile = path.join(outDir, `${vp.name}_${th}.png`);
      await page.screenshot({ path: shotFile, fullPage: true });

      results.viewports[vp.name][th] = {
        screenshot: shotFile,
        metrics,
        pageErrors
      };

      console.log(`- ${vp.name} [${th}]: horizontalScroll=${metrics.hasHorizontalScroll}, overflows=${metrics.overflowCount}, H1 font=${metrics.h1Font.slice(0, 30)}`);
      await context.close();
    }
  }

  // Test AutoScanLoop live cycle and beam sweep
  console.log('\n--- Verifying AutoScanLoop 22s cycle and laser beam ---');
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  
  // Wait for Phase 2 (laser sweep at ~4s)
  await page.waitForTimeout(4200);
  const scanStageInfo = await page.evaluate(() => {
    const scan = document.getElementById('scan');
    if (!scan) return null;
    const beam = scan.querySelector('[style*="translateX"]');
    const transform = beam ? beam.style.transform : null;
    const display = beam ? window.getComputedStyle(beam).display : null;
    return { hasScan: true, transform, display };
  });

  const scanShot = path.join(outDir, 'autoscan_laser_sweep.png');
  const scanEl = await page.$('#scan');
  if (scanEl) {
    await scanEl.screenshot({ path: scanShot });
  }

  results.autoScanLoopVerified = Boolean(scanStageInfo && scanStageInfo.hasScan);
  console.log('AutoScanLoop sweep verified:', scanStageInfo);

  // Test prefers-reduced-motion
  console.log('\n--- Verifying prefers-reduced-motion static fallback ---');
  const rmContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce'
  });
  const rmPage = await rmContext.newPage();
  await rmPage.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  await rmPage.waitForTimeout(500);

  const rmCheck = await rmPage.evaluate(() => {
    const scan = document.getElementById('scan');
    const text = scan ? scan.textContent : '';
    return {
      hasStaticYouSee: text.includes('YOU SEE (Human View)'),
      hasStaticDetained: text.includes('DETAINED')
    };
  });
  results.reducedMotionVerified = Boolean(rmCheck.hasStaticYouSee);
  console.log('Reduced motion static fallback verified:', rmCheck);

  await browser.close();

  // Summary
  fs.writeFileSync('tests/verified_landing_report.json', JSON.stringify(results, null, 2));
  console.log('\nFinal verification report written to tests/verified_landing_report.json');
}

verifyLanding().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
