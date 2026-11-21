/**
 * Scan Normalization & Defensive Fallbacks for MailMind AI Checkpoint / X-Ray
 * 
 * Safely sanitizes and normalizes scan results, layer findings, threat scores,
 * and hidden segments so React components never crash when rendering unexpected data structures.
 */

/**
 * Safely converts any layer finding into a displayable string.
 * Supports strings and structured objects (e.g. { signal, reason } from Layer 4).
 * Prevents React 19 "Objects are not valid as a React child" crashes.
 */
export function normalizeFinding(f) {
  if (f == null) return '';
  if (typeof f === 'string') return f;
  if (typeof f === 'object') {
    return f.reason || f.signal || (f.message ? f.message : JSON.stringify(f));
  }
  return String(f);
}

/**
 * Normalizes raw API scan payload with safe defaults for every field.
 * Handles stringified JSON for layers / hiddenSegments and provides fallback values.
 */
export function normalizeScanData(raw) {
  if (!raw) return null;

  // Handle layers: stringified JSON, array, or missing
  let layers = raw.layers;
  if (typeof layers === 'string') {
    try { layers = JSON.parse(layers); } catch (e) { layers = []; }
  } else if (!Array.isArray(layers)) {
    if (typeof raw.layers_json === 'string') {
      try { layers = JSON.parse(raw.layers_json); } catch (e) { layers = []; }
    } else {
      layers = [];
    }
  }

  // Defensively ensure each layer has safe score, status, name, and string findings
  layers = (layers || []).map((layer, idx) => {
    let findings = layer.findings || [];
    if (typeof findings === 'string') {
      try { findings = JSON.parse(findings); } catch (e) { findings = [findings]; }
    }
    if (!Array.isArray(findings)) findings = [];
    const normalizedFindings = findings.map(normalizeFinding);

    return {
      ...layer,
      name: layer.name || `Layer ${idx + 1}`,
      status: layer.status || 'CLEARED',
      score: typeof layer.score === 'number' ? layer.score : 0,
      findings: normalizedFindings
    };
  });

  // Handle hiddenSegments: stringified JSON, array, or missing
  let hiddenSegments = raw.hiddenSegments;
  if (typeof hiddenSegments === 'string') {
    try { hiddenSegments = JSON.parse(hiddenSegments); } catch (e) { hiddenSegments = []; }
  } else if (!Array.isArray(hiddenSegments)) {
    if (typeof raw.hidden_segments_json === 'string') {
      try { hiddenSegments = JSON.parse(raw.hidden_segments_json); } catch (e) { hiddenSegments = []; }
    } else {
      hiddenSegments = [];
    }
  }

  const threatScore = typeof raw.threatScore === 'number'
    ? raw.threatScore
    : (typeof raw.threat_score === 'number' ? raw.threat_score : 0);

  const verdict = (raw.verdict || raw.shield_verdict || 'UNSCANNED').toUpperCase();

  return {
    id: raw.id || raw.scanId || null,
    emailId: raw.emailId || raw.email_id || raw.id,
    subject: raw.subject || raw.email?.subject || '(No Subject)',
    sender: raw.sender || raw.email?.sender || 'Unknown Sender',
    verdict,
    threatScore,
    visibleText: raw.visibleText ?? raw.visible_text ?? raw.body_text ?? raw.email?.body_text ?? '',
    aiText: raw.aiText ?? raw.ai_text ?? raw.body_text ?? raw.email?.body_text ?? '',
    layers,
    hiddenSegments: Array.isArray(hiddenSegments) ? hiddenSegments : [],
    senderProfile: raw.senderProfile || null,
    headersMeta: raw.headersMeta || null,
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString()
  };
}
