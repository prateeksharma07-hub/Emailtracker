import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Explicitly resolve .env relative to server root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { analyzeDraftTone } from '../services/regret/toneCheck.js';

/**
 * Standalone Smoke Test for Regret Shield Groq Tone Analyzer
 * 
 * Evaluates real Groq model responses against 5 scenario drafts:
 * 1. Polite
 * 2. Harsh
 * 3. Passive-Aggressive
 * 4. Commitment
 * 5. Hinglish
 * 
 * STRICT PRIVACY & SAFETY RULES:
 * - NEVER prints draft text or API key
 * - Exits gracefully (code 0) if GROQ_API_KEY is not configured
 * - Strips code fences and performs a single retry on transient failures
 */

const SCENARIOS = [
  {
    name: 'Polite Inquiry',
    draft: 'Dear Sarah, thank you for sending over the quarterly summary. I have reviewed the slides and everything looks great. Looking forward to our discussion on Tuesday.'
  },
  {
    name: 'Harsh / Accusatory',
    draft: 'This entire deliverable is total incompetence. You completely failed to follow basic instructions. Fix this garbage immediately or I will demand executive action.'
  },
  {
    name: 'Passive-Aggressive',
    draft: 'Per my previous email which you apparently did not bother to read, the timeline was already set. Next time please pay closer attention before wasting team time.'
  },
  {
    name: 'Explicit Commitment',
    draft: 'I promise to complete the database indexing migration by Friday at 4 PM, and our finance department will wire the invoice payment of $3,500 by Monday noon.'
  },
  {
    name: 'Hinglish Reassurance',
    draft: 'Bhai kal tak payment pakka release kar dunga tension mat lo, aur delivery report Thursday evening tak submit ho jayegi.'
  }
];

async function runScenario(scenario, retryCount = 0) {
  const startTime = Date.now();
  try {
    const result = await analyzeDraftTone(scenario.draft);
    const latencyMs = Date.now() - startTime;

    // If result was unavailable and we haven't retried yet, retry once
    if (!result.toneCheckAvailable && retryCount < 1) {
      return runScenario(scenario, retryCount + 1);
    }

    return {
      scenario: scenario.name,
      validJson: result.toneCheckAvailable,
      riskLevel: result.risk_level,
      flagsCount: Array.isArray(result.flags) ? result.flags.length : 0,
      commitmentsCount: Array.isArray(result.commitments) ? result.commitments.length : 0,
      hasRewrite: Boolean(result.softer_rewrite),
      latencyMs
    };
  } catch (err) {
    if (retryCount < 1) {
      return runScenario(scenario, retryCount + 1);
    }
    const latencyMs = Date.now() - startTime;
    return {
      scenario: scenario.name,
      validJson: false,
      riskLevel: 'error',
      flagsCount: 0,
      commitmentsCount: 0,
      hasRewrite: false,
      latencyMs,
      error: err.message
    };
  }
}

async function main() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !apiKey.trim() || apiKey.includes('your_') || apiKey.includes('placeholder')) {
    console.log('\n[Regret Shield Smoke Test] Notice: GROQ_API_KEY is not configured in environment or .env.');
    console.log('[Regret Shield Smoke Test] Skipping live Groq smoke test gracefully (exiting with code 0).\n');
    process.exit(0);
  }

  console.log('\n================================================================');
  console.log('🛡️  MAILMIND AI — REGRET SHIELD GROQ SMOKE TEST');
  console.log('   Evaluating 5 real draft scenarios across Groq LPU...');
  console.log('   (Strict Zero-Leak: Draft texts and API keys are NEVER printed)');
  console.log('================================================================\n');

  const results = [];
  for (const sc of SCENARIOS) {
    process.stdout.write(`Evaluating scenario: "${sc.name}"... `);
    const res = await runScenario(sc);
    results.push(res);
    console.log(`Done (${res.latencyMs}ms, Risk: ${res.riskLevel.toUpperCase()})`);
  }

  console.log('\n┌────────────────────────┬────────────┬────────────┬─────────────┬─────────────┬─────────┬────────────┐');
  console.log('│ Scenario               │ Valid JSON │ Risk Level │ Flags Count │ Commitments │ Rewrite │ Latency    │');
  console.log('├────────────────────────┼────────────┼────────────┼─────────────┼─────────────┼─────────┼────────────┤');
  for (const r of results) {
    const sc = r.scenario.padEnd(22);
    const vj = (r.validJson ? '✅ YES' : '❌ NO').padEnd(10);
    const rl = (r.riskLevel || 'unknown').toUpperCase().padEnd(10);
    const fc = String(r.flagsCount).padEnd(11);
    const cc = String(r.commitmentsCount).padEnd(11);
    const rw = (r.hasRewrite ? 'YES' : 'NO').padEnd(7);
    const lt = `${r.latencyMs}ms`.padEnd(10);
    console.log(`│ ${sc} │ ${vj} │ ${rl} │ ${fc} │ ${cc} │ ${rw} │ ${lt} │`);
  }
  console.log('└────────────────────────┴────────────┴────────────┴─────────────┴─────────────┴─────────┴────────────┘\n');

  const allValid = results.every(r => r.validJson);
  if (allValid) {
    console.log('✅ Real Groq Smoke Test completed successfully. All 5 scenarios produced valid structured JSON.\n');
  } else {
    console.warn('⚠️  Some scenarios encountered JSON or network issues (handled gracefully).\n');
  }
}

main().catch(err => {
  console.error('[Smoke Test Error]', err.message);
  process.exit(1);
});
