import { chromium } from 'playwright';
import { db } from '../server/db/database.js';
import fs from 'node:fs';
import path from 'node:path';

async function reproduceBug() {
  console.log('=== [REPRODUCE] Starting Bug Reproduction Script ===');

  // 1. Ensure test user & active session exist
  const userId = 'usr_b3fb13af9c0a557b';
  const sessionId = 'test_session_reproduce_12345';
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

  db.prepare(`
    INSERT OR REPLACE INTO sessions (id, user_id, expires_at, created_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `).run(sessionId, userId, expiresAt);

  console.log(`[Database] Seeded test session ${sessionId} for user ${userId}`);

  // 2. Launch headless Chrome via Playwright
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const context = await browser.newContext();

  // Set the session cookie
  await context.addCookies([
    {
      name: 'mailmind_session',
      value: sessionId,
      domain: 'localhost',
      path: '/'
    }
  ]);

  const page = await context.newPage();

  const consoleLogs = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (msg.type() === 'error') {
      console.error('[Browser Console Error]', text);
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message + '\n' + err.stack);
    console.error('[Browser Uncaught PageError]', err.message);
  });

  page.on('response', async res => {
    if (res.status() >= 400) {
      let body = '';
      try { body = await res.text(); } catch(e) {}
      failedRequests.push({ url: res.url(), status: res.status(), body });
      console.warn(`[Failed Network Call] ${res.status()} ${res.url()} - ${body}`);
    }
  });

  console.log('[Browser] Navigating to http://localhost:5174 ...');
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });

  // Verify that we are logged in
  await page.waitForTimeout(1000);
  console.log('[Browser] Page loaded, looking for Checkpoint navigation button...');

  // Click on "Checkpoint (X-Ray)" or "Checkpoint" tab
  // Let's find button with text containing Checkpoint
  const checkpointBtn = page.locator('button:has-text("Checkpoint")').first();
  const btnCount = await checkpointBtn.count();
  console.log(`[Browser] Found ${btnCount} Checkpoint button(s)`);

  if (btnCount > 0) {
    console.log('[Browser] Clicking Checkpoint button...');
    await checkpointBtn.click();
    await page.waitForTimeout(2000);
  } else {
    console.log('[Browser] Button not found by text, searching buttons...');
  }

  // Take screenshot of whatever is rendered (blank screen!)
  const screenshotPath = path.resolve('reproduce_blank_checkpoint.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`[Browser] Screenshot saved to ${screenshotPath}`);

  // Check root element children
  const rootHtml = await page.evaluate(() => {
    const root = document.getElementById('root');
    return {
      innerHTML: root ? root.innerHTML : 'no root',
      childElementCount: root ? root.childElementCount : 0
    };
  });
  console.log('[Browser] #root child elements count:', rootHtml.childElementCount);
  console.log('[Browser] #root innerHTML length:', rootHtml.innerHTML.length);

  await browser.close();

  console.log('\n=== REPRODUCTION SUMMARY ===');
  console.log('Page Errors Count:', pageErrors.length);
  pageErrors.forEach((e, i) => console.log(`Error ${i + 1}:\n${e}`));
  console.log('Failed Requests Count:', failedRequests.length);

  // Write reproduction report
  fs.writeFileSync('reproduce_checkpoint_report.json', JSON.stringify({
    pageErrors,
    consoleErrors: consoleLogs.filter(l => l.type === 'error'),
    failedRequests,
    rootHtml
  }, null, 2));

  console.log('Report saved to reproduce_checkpoint_report.json');
}

reproduceBug().catch(err => {
  console.error('Fatal reproduction script error:', err);
  process.exit(1);
});
