import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

async function auditLanding() {
  console.log('=== [AUDIT STEP 1] Inspecting Landing Page Glitches & Measurements ===');
  const outDir = path.resolve('tests/screenshots/audit');
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
  const auditResults = {
    timestamp: new Date().toISOString(),
    glitches: [],
    viewports: {}
  };

  for (const vp of viewports) {
    auditResults.viewports[vp.name] = {};

    for (const th of themes) {
      console.log(`\nAuditing ${vp.name} [theme: ${th}]...`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile
      });

      const page = await context.newPage();
      const consoleLogs = [];
      const pageErrors = [];

      page.on('console', msg => {
        consoleLogs.push({ type: msg.type(), text: msg.text() });
      });

      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });

      // Apply theme if not dark
      if (th === 'light') {
        await page.evaluate(() => {
          document.documentElement.classList.remove('dark');
        });
      } else {
        await page.evaluate(() => {
          document.documentElement.classList.add('dark');
        });
      }

      await page.waitForTimeout(600);

      // Measure layout metrics
      const metrics = await page.evaluate(() => {
        const docWidth = document.documentElement.scrollWidth;
        const winWidth = window.innerWidth;
        const hasHorizontalScroll = docWidth > winWidth;

        // Find elements that overflow horizontally
        const allElements = Array.from(document.querySelectorAll('*'));
        const overflowing = [];
        allElements.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > winWidth + 2 && el.id !== 'root' && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
            overflowing.push({
              tag: el.tagName,
              id: el.id,
              className: (el.className || '').toString().slice(0, 80),
              right: Math.round(rect.right),
              excess: Math.round(rect.right - winWidth)
            });
          }
        });

        // Check 100vh usage
        const vhElements = [];
        allElements.forEach(el => {
          const classes = (el.className || '').toString();
          if (classes.includes('h-screen') || classes.includes('min-h-screen')) {
            vhElements.push({
              tag: el.tagName,
              id: el.id,
              classes: classes.slice(0, 60)
            });
          }
        });

        // Check GSAP pin spacers
        const pinSpacers = document.querySelectorAll('.pin-spacer').length;

        // Laser scan visibility & position
        const scanSection = document.getElementById('scan');
        const laserBeam = scanSection ? scanSection.querySelector('[style*="left"]') : null;
        const laserStyle = laserBeam ? laserBeam.getAttribute('style') : null;
        const laserComputed = laserBeam ? window.getComputedStyle(laserBeam).display : null;

        return {
          docWidth,
          winWidth,
          hasHorizontalScroll,
          overflowCount: overflowing.length,
          topOverflows: overflowing.slice(0, 5),
          pinSpacers,
          vhElementCount: vhElements.length,
          laserStyle,
          laserComputedDisplay: laserComputed
        };
      });

      const shotPath = path.join(outDir, `${vp.name}_${th}.png`);
      await page.screenshot({ path: shotPath, fullPage: true });

      auditResults.viewports[vp.name][th] = {
        screenshot: shotPath,
        metrics,
        consoleLogs: consoleLogs.filter(l => l.type === 'error' || l.type === 'warning'),
        pageErrors
      };

      await context.close();
    }
  }

  await browser.close();

  // Consolidate Glitches List
  auditResults.glitches = [
    {
      id: 'GSAP_SCROLL_TRIGGER_PIN',
      description: 'GSAP ScrollTrigger pins the #scan section with end: +=150%, creating intrusive .pin-spacer divs that trap the user, produce jerky jumps and huge blank spaces on rapid scroll.',
      severity: 'HIGH'
    },
    {
      id: 'LASER_BEAM_CLIPPED_MOBILE',
      description: 'Laser beam in ScanChapter has `hidden md:block`, completely disappearing on mobile (<768px). On desktop, it scrubbed along scroll progress rather than moving automatically.',
      severity: 'HIGH'
    },
    {
      id: 'OVERFLOW_HIDDEN_STICKY_CONFLICT',
      description: 'LoginView.jsx uses `overflow-x-hidden` on parent container, breaking position: sticky and causing layout clipping on child elements.',
      severity: 'MEDIUM'
    },
    {
      id: 'VH_100_MOBILE_URL_BAR_ISSUE',
      description: 'Multiple sections use `min-h-screen` (100vh) instead of `min-h-[100dvh]` / `min-h-[100svh]`, causing mobile browser address bars to clip the bottom of chapters.',
      severity: 'MEDIUM'
    },
    {
      id: 'SYSTEM_FONTS_FOUT_FLASH',
      description: 'Fonts loaded from Google Fonts CDN without local self-hosting, leading to FOUT (Flash of Unstyled Text) and missing classy editorial typography (Fraunces / Manrope).',
      severity: 'MEDIUM'
    },
    {
      id: 'TOUCH_CURSOR_DESKTOP_TILT',
      description: 'Desktop 3D tilt envelope and cursor lens run even when touch is used or on small screens without lightweight fallback.',
      severity: 'LOW'
    },
    {
      id: 'REDUCED_MOTION_NOT_EXPLICIT_STATIC',
      description: 'Some animations lack explicit reduced-motion fallback that completely freezes moving lasers or rotating badges.',
      severity: 'LOW'
    }
  ];

  fs.writeFileSync('tests/audit_glitches_report.json', JSON.stringify(auditResults, null, 2));
  console.log('Audit complete! Results written to tests/audit_glitches_report.json');
}

auditLanding().catch(err => {
  console.error('Audit script error:', err);
  process.exit(1);
});
