import { inspectHtmlContent } from './htmlInspector.js';
import { scanOverridePatterns } from './overridePatterns.js';
import { runPromptGuardScan } from './promptGuard.js';
import { evaluateSenderTrust } from './senderTrust.js';

/**
 * Shield Pipeline Orchestrator (Phase 1: Shield + X-Ray)
 * 
 * Multi-layer AI Email Firewall defending MailMind against prompt injections,
 * hidden adversarial instructions, and steganographic payloads.
 * 
 * LAYERS:
 * 1. HTML & Structural Inspector (CSS hidden rules, Unicode zero-width/tags, comments)
 * 2. Instruction-Override Language Engine (Weighted multilingual pattern scanner)
 * 3. Groq Prompt Guard 2 Scanner (meta-llama/llama-prompt-guard-2-22m)
 * 4. Output Validation (Applied post-LLM generation)
 * 5. Composite Policy Engine (Verdict assignment with newsletter preheader tolerance)
 * 
 * FAIL-CLOSED POLICY:
 * If an unexpected pipeline exception occurs, the email is classified as SUSPICIOUS (never CLEARED).
 */

/**
 * Determines if hidden content appears to be a benign email newsletter preheader
 */
function isBenignPreheader(hiddenSegments = []) {
  if (hiddenSegments.length === 0) return false;

  const benignPhrases = [
    'view in browser',
    'view this email in your browser',
    'unsubscribe',
    'having trouble viewing',
    'privacy policy',
    'newsletter',
    'click here to view'
  ];

  // If every hidden segment is short and looks like standard preheader or footer
  return hiddenSegments.every(seg => {
    const text = (seg.text || '').toLowerCase().trim();
    return text.length < 150 && benignPhrases.some(p => text.includes(p));
  });
}

/**
 * Scans an email through the defensive Shield pipeline
 * 
 * @param {object} email - { body_html, body_text, snippet, subject, sender }
 * @returns {Promise<object>} Comprehensive scan result with verdict, score, layers, and X-Ray text
 */
export async function runShieldPipeline(email = {}, injectedContext = null) {
  try {
    const rawHtml = email.body_html || email.bodyHtml || '';
    const rawText = email.body_text || email.bodyText || email.snippet || '';

    // --- LAYER 1: HTML & Structural Inspector ---
    const layer1Result = inspectHtmlContent(rawHtml, rawText);
    const visibleText = layer1Result.visibleText;
    const aiText = layer1Result.aiText;
    const hiddenSegments = layer1Result.hiddenSegments;

    // --- LAYER 2: Instruction-Override Language Scanner ---
    // Scan both visible text and full naive AI text (to catch instructions hidden in CSS/comments)
    const layer2Result = scanOverridePatterns(aiText);

    // --- LAYER 3: Groq Prompt Guard 2 Scanner ---
    // If hidden text exists, scan aiText; otherwise scan visibleText
    const textToGuardScan = hiddenSegments.length > 0 ? aiText : visibleText;
    const layer3Result = await runPromptGuardScan(textToGuardScan);

    // --- LAYER 4: Sender Trust & Identity Memory (if feature flag active) ---
    let layer4Result = null;
    const isSenderTrustEnabled = process.env.FEATURE_SENDER_TRUST !== 'false';
    if (isSenderTrustEnabled) {
      layer4Result = evaluateSenderTrust(email, injectedContext);
    }

    // --- LAYER 5: Composite Policy Engine ---
    // Check for newsletter preheaders
    const hasBenignPreheaderOnly = isBenignPreheader(hiddenSegments);

    // Calculate composite threat score (0-100)
    let compositeScore = 0;

    // Weight allocation:
    // Layer 1 (Structural): up to 35 pts (unless benign preheader)
    const structuralScore = hasBenignPreheaderOnly ? Math.min(15, layer1Result.score * 0.3) : layer1Result.score;
    compositeScore += structuralScore * 0.35;

    // Layer 2 (Patterns): up to 45 pts
    compositeScore += layer2Result.score * 0.45;

    // Layer 3 (Prompt Guard): up to 40 pts (if available)
    if (layer3Result.status !== 'unavailable') {
      compositeScore += layer3Result.score * 0.40;
    } else {
      // Rebalance if prompt guard is offline
      compositeScore = (compositeScore / 0.80);
    }

    // Layer 4 (Sender Trust contribution): adds risk if anomaly detected
    if (layer4Result && !layer4Result.noSenderContext && !layer4Result.unavailable && layer4Result.score > 0) {
      compositeScore += (layer4Result.score * 0.30);
    }

    const threatScore = Math.min(100, Math.round(compositeScore));

    // VERDICT DECISION RULES:
    // Baseline detection rules
    let verdict = 'CLEARED';

    if (layer2Result.score >= 45 || layer3Result.score >= 80) {
      verdict = 'DETAINED';
    } else if (hiddenSegments.length > 0 && (layer2Result.score >= 25 || layer3Result.score >= 40)) {
      verdict = 'DETAINED';
    } else if (hiddenSegments.length > 0 && !hasBenignPreheaderOnly) {
      verdict = 'SUSPICIOUS';
    } else if (threatScore >= 30) {
      verdict = 'SUSPICIOUS';
    } else {
      verdict = 'CLEARED';
    }

    // LAYER 4 INVARIANTS:
    // - Layer only increases risk, never decreases (trusted sender does not downgrade existing DETAINED).
    // - Blocked sender OR (spoof/lookalike/auth_fail + risky_ask) => DETAINED.
    // - Sender anomaly alone without risky ask => MAX SUSPICIOUS (never DETAINED).
    if (layer4Result) {
      if (layer4Result.status === 'DETAINED') {
        verdict = 'DETAINED';
      } else if (layer4Result.status === 'SUSPICIOUS' && verdict === 'CLEARED') {
        verdict = 'SUSPICIOUS';
      }
    }

    const layers = [
      {
        name: 'HTML & Structure Inspector',
        status: layer1Result.status,
        score: layer1Result.score,
        findings: layer1Result.findings
      },
      {
        name: 'Override Pattern Engine',
        status: layer2Result.status,
        score: layer2Result.score,
        findings: layer2Result.findings
      },
      {
        name: 'Groq Prompt Guard 2',
        status: layer3Result.status,
        score: layer3Result.score,
        findings: layer3Result.findings
      }
    ];

    if (layer4Result) {
      layers.push({
        name: layer4Result.name || 'Sender Trust & Identity Memory',
        status: layer4Result.status,
        score: layer4Result.score,
        findings: layer4Result.findings,
        label: layer4Result.label,
        profileSummary: layer4Result.profileSummary,
        unavailable: Boolean(layer4Result.unavailable),
        noSenderContext: Boolean(layer4Result.noSenderContext)
      });
    }

    return {
      verdict,
      threatScore,
      visibleText,
      aiText,
      hiddenSegments,
      layers
    };
  } catch (err) {
    console.error('[Shield Pipeline Error] Fail-closed safeguard engaged:', err.message);
    // FAIL-CLOSED: Mark as SUSPICIOUS, never CLEARED
    return {
      verdict: 'SUSPICIOUS',
      threatScore: 60,
      visibleText: email.body_text || email.snippet || '',
      aiText: email.body_text || email.snippet || '',
      hiddenSegments: [],
      layers: [
        {
          name: 'Shield Pipeline Fail-Closed Monitor',
          status: 'SUSPICIOUS',
          score: 60,
          findings: [`Shield scan error encountered: ${err.message}. Fail-closed safety policy applied.`]
        }
      ]
    };
  }
}
