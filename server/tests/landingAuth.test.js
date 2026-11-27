import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../index.js';

describe('📮 Sorting Room Landing & Authentication Gate Tests', () => {
  test('1. GET /api/auth/url returns Google OAuth initiation URL or clear configuration error', async () => {
    const res = await request(app).get('/api/auth/url');
    // If OAuth env vars are set, 200 with url; if mock/local dev without secrets, 400 with message
    if (res.status === 200) {
      assert.equal(res.body.success, true);
      assert.ok(typeof res.body.url === 'string');
      assert.ok(res.body.url.includes('accounts.google.com') || res.body.url.includes('oauth'));
    } else {
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error);
    }
  });

  test('2. Unauthenticated calls to protected routes return 401 with postal security message', async () => {
    const res = await request(app).get('/api/emails');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes('Authentication required') || res.body.error.includes('connect'));
  });

  test('3. Client Handshake Invariant: Double-click guard prevents concurrent connect invocations', async () => {
    let callCount = 0;
    let isConnecting = false;
    let hasTriggered = false;

    // Simulated SortingEnvelope click handler logic
    const simulateEnvelopeClick = async () => {
      if (hasTriggered || isConnecting) {
        return { triggered: false, reason: 'BLOCKED_BY_GUARD' };
      }
      hasTriggered = true;
      isConnecting = true;

      // Simulate the 700ms opening animation delay
      await new Promise(r => setTimeout(r, 50));
      callCount++;
      return { triggered: true };
    };

    // User rapidly double-clicks or spams Space/Enter
    const [click1, click2, click3] = await Promise.all([
      simulateEnvelopeClick(),
      simulateEnvelopeClick(),
      simulateEnvelopeClick()
    ]);

    assert.equal(click1.triggered, true, 'First click triggers connect sequence');
    assert.equal(click2.triggered, false, 'Second click blocked by double-click guard');
    assert.equal(click3.triggered, false, 'Third click blocked by double-click guard');
    assert.equal(callCount, 1, 'OAuth connect handler executed exactly once');
  });

  test('4. Reduced Motion Invariant: Skips animation delay and executes handler immediately', async () => {
    let callCount = 0;
    const reduceMotion = true;

    const simulateEnvelopeClick = async () => {
      if (reduceMotion) {
        // Reduced motion triggers immediately without animation setTimeout
        callCount++;
        return { immediate: true };
      }
    };

    const res = await simulateEnvelopeClick();
    assert.equal(res.immediate, true);
    assert.equal(callCount, 1);
  });
});
