import { test, describe, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';

// Ensure test environment is set
process.env.NODE_ENV = 'test';

import { app, validateEnvironment } from '../index.js';
import { getCookieOptions } from '../routes/auth.js';

describe('🚀 Deployment Configuration & Security Guard Tests', () => {
  const originalEnv = { ...process.env };

  after(() => {
    process.env = { ...originalEnv };
  });

  test('1. Health check: GET /api/health returns 200 and { status: "ok" } without auth', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200);

    assert.strictEqual(res.body.status, 'ok');
  });

  test('2. Cache-Control: all /api responses enforce "Cache-Control: no-store"', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200);

    const cacheControl = res.headers['cache-control'];
    assert.ok(cacheControl, 'Cache-Control header must be present');
    assert.ok(cacheControl.includes('no-store'), 'Cache-Control must contain "no-store"');
  });

  test('3. Environment validation: fails with clean error when required variables are missing', () => {
    // Missing all required variables in production
    assert.throws(
      () => {
        validateEnvironment({ NODE_ENV: 'production' }, false);
      },
      (err) => {
        assert.ok(err.message.includes('[Startup Error] Missing required environment variable(s)'));
        assert.ok(err.missingVars.includes('GOOGLE_CLIENT_ID'));
        assert.ok(err.missingVars.includes('GOOGLE_CLIENT_SECRET'));
        assert.ok(err.missingVars.includes('GOOGLE_REDIRECT_URI'));
        assert.ok(err.missingVars.includes('GROQ_API_KEY'));
        assert.ok(err.missingVars.includes('TOKEN_ENC_KEY'));
        assert.ok(err.missingVars.includes('SESSION_SECRET'));
        assert.ok(err.missingVars.includes('APP_URL'));
        // Ensure no actual secret values are printed
        assert.strictEqual(err.message.includes('gsk_'), false);
        return true;
      }
    );

    // Missing only APP_URL in production
    assert.throws(
      () => {
        validateEnvironment({
          NODE_ENV: 'production',
          GOOGLE_CLIENT_ID: 'dummy_client_id.apps.googleusercontent.com',
          GOOGLE_CLIENT_SECRET: 'dummy_secret',
          GOOGLE_REDIRECT_URI: 'http://localhost:5001/api/auth/callback',
          GROQ_API_KEY: 'gsk_dummy_groq_key',
          TOKEN_ENC_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          SESSION_SECRET: 'dummy_session_secret'
          // APP_URL missing
        }, false);
      },
      (err) => {
        assert.ok(err.missingVars.includes('APP_URL'));
        assert.strictEqual(err.missingVars.length, 1);
        return true;
      }
    );

    // Passes cleanly when all required variables are present
    assert.doesNotThrow(() => {
      validateEnvironment({
        NODE_ENV: 'production',
        GOOGLE_CLIENT_ID: 'dummy_client_id.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'dummy_secret',
        GOOGLE_REDIRECT_URI: 'http://localhost:5001/api/auth/callback',
        GROQ_API_KEY: 'gsk_dummy_groq_key',
        TOKEN_ENC_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        SESSION_SECRET: 'dummy_session_secret',
        APP_URL: 'https://mailmind.vercel.app'
      }, false);
    });
  });

  test('4. Trust Proxy: app.set("trust proxy", 1) is active for secure reverse-proxying', () => {
    const trustProxy = app.get('trust proxy');
    assert.strictEqual(trustProxy, 1, 'trust proxy must be configured to 1 for Render / Vercel');
  });

  test('5. Session Cookie: production enforces httpOnly, secure, sameSite=lax', () => {
    // In production
    process.env.NODE_ENV = 'production';
    const prodOptions = getCookieOptions();
    assert.strictEqual(prodOptions.httpOnly, true);
    assert.strictEqual(prodOptions.secure, true);
    assert.strictEqual(prodOptions.sameSite, 'lax');
    assert.strictEqual(prodOptions.path, '/');

    // In development / test
    process.env.NODE_ENV = 'development';
    const devOptions = getCookieOptions();
    assert.strictEqual(devOptions.httpOnly, true);
    assert.strictEqual(devOptions.secure, false);
    assert.strictEqual(devOptions.sameSite, 'lax');

    // Restore test env
    process.env.NODE_ENV = 'test';
  });

  test('6. CSRF / Origin Guard: rejects requests with untrusted Origin header', async () => {
    process.env.APP_URL = 'https://mailmind.vercel.app';
    process.env.NODE_ENV = 'production';

    // Untrusted origin should be rejected with 403
    const blockedRes = await request(app)
      .post('/api/auth/logout')
      .set('Origin', 'https://attacker-phishing-site.com')
      .expect(403);

    assert.strictEqual(blockedRes.body.code, 'CSRF_ORIGIN_MISMATCH');

    // Trusted origin matching APP_URL should pass origin check
    const allowedRes = await request(app)
      .post('/api/auth/logout')
      .set('Origin', 'https://mailmind.vercel.app');

    assert.notStrictEqual(allowedRes.status, 403);
    assert.notStrictEqual(allowedRes.body.code, 'CSRF_ORIGIN_MISMATCH');

    // Request without Origin header (e.g. server-to-server or same-origin rewrite) should pass
    const noOriginRes = await request(app)
      .post('/api/auth/logout');

    assert.notStrictEqual(noOriginRes.status, 403);
    assert.notStrictEqual(noOriginRes.body.code, 'CSRF_ORIGIN_MISMATCH');

    process.env.NODE_ENV = 'test';
  });
});
