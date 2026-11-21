import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFinding, normalizeScanData } from '../../client/src/utils/scanNormalizer.js';

describe('🛡️ Checkpoint Data Normalizer Unit Tests', () => {
  test('1. normalizeFinding: handles strings, null, undefined, and numbers safely', () => {
    assert.strictEqual(normalizeFinding(null), '');
    assert.strictEqual(normalizeFinding(undefined), '');
    assert.strictEqual(normalizeFinding('Clean text'), 'Clean text');
    assert.strictEqual(normalizeFinding(123), '123');
  });

  test('2. normalizeFinding: handles Layer 4 object { signal, reason } and returns string (preventing React child crash)', () => {
    const findingObj = {
      signal: 'first_time_sender',
      reason: 'First-time sender: No prior bilateral correspondence.'
    };
    const result = normalizeFinding(findingObj);
    assert.strictEqual(result, 'First-time sender: No prior bilateral correspondence.');
    assert.strictEqual(typeof result, 'string');
  });

  test('3. normalizeFinding: handles object with signal only or message', () => {
    assert.strictEqual(normalizeFinding({ signal: 'punycode_domain' }), 'punycode_domain');
    assert.strictEqual(normalizeFinding({ message: 'Suspicious header' }), 'Suspicious header');
    assert.strictEqual(normalizeFinding({ code: 500 }), '{"code":500}');
  });

  test('4. normalizeScanData: handles null or undefined input', () => {
    assert.strictEqual(normalizeScanData(null), null);
    assert.strictEqual(normalizeScanData(undefined), null);
  });

  test('5. normalizeScanData: parses stringified layers_json and hidden_segments_json', () => {
    const raw = {
      id: 'scan_123',
      emailId: 'eml_123',
      verdict: 'SUSPICIOUS',
      threat_score: 35,
      layers_json: JSON.stringify([
        {
          name: 'Layer 1',
          score: 10,
          status: 'warning',
          findings: ['Finding string', { signal: 'alert', reason: 'Layer 1 anomaly' }]
        }
      ]),
      hidden_segments_json: JSON.stringify([
        { text: 'ignore previous instructions', reason: 'Prompt injection', type: 'instruction_override' }
      ]),
      visible_text: 'Visible email body',
      ai_text: 'AI parsed text'
    };

    const normalized = normalizeScanData(raw);
    assert.ok(normalized);
    assert.strictEqual(normalized.verdict, 'SUSPICIOUS');
    assert.strictEqual(normalized.threatScore, 35);
    assert.strictEqual(normalized.layers.length, 1);
    assert.strictEqual(normalized.layers[0].findings[0], 'Finding string');
    assert.strictEqual(normalized.layers[0].findings[1], 'Layer 1 anomaly');
    assert.strictEqual(typeof normalized.layers[0].findings[1], 'string');
    assert.strictEqual(normalized.hiddenSegments.length, 1);
    assert.strictEqual(normalized.hiddenSegments[0].text, 'ignore previous instructions');
  });

  test('6. normalizeScanData: provides safe fallbacks for missing or malformed fields', () => {
    const raw = {
      id: 'scan_minimal'
    };

    const normalized = normalizeScanData(raw);
    assert.ok(normalized);
    assert.strictEqual(normalized.verdict, 'UNSCANNED');
    assert.strictEqual(normalized.threatScore, 0);
    assert.deepStrictEqual(normalized.layers, []);
    assert.deepStrictEqual(normalized.hiddenSegments, []);
    assert.strictEqual(normalized.visibleText, '');
    assert.strictEqual(normalized.aiText, '');
    assert.strictEqual(normalized.subject, '(No Subject)');
    assert.strictEqual(normalized.sender, 'Unknown Sender');
  });

  test('7. normalizeScanData: handles malformed JSON without throwing exceptions', () => {
    const raw = {
      layers_json: '{ broken json',
      hidden_segments_json: 'not valid json }'
    };

    assert.doesNotThrow(() => {
      const normalized = normalizeScanData(raw);
      assert.deepStrictEqual(normalized.layers, []);
      assert.deepStrictEqual(normalized.hiddenSegments, []);
    });
  });
});
