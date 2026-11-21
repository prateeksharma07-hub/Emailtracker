import * as cheerio from 'cheerio';

/**
 * Layer 1: HTML & Structural Inspector
 * 
 * Inspects raw email HTML and text for hidden adversarial content:
 * - CSS hiding mechanisms (display:none, visibility:hidden, opacity, font-size 0, off-screen, etc.)
 * - Same-color text on background (white-on-white, transparent)
 * - HTML comments & <template> tags containing instruction payloads
 * - Invisible & steganographic Unicode characters (zero-width, bidi overrides, Unicode tags)
 * 
 * LIMITATION NOTICE:
 * Handles inline styles and embedded <style> declaration rules. Complex external stylesheets
 * or dynamic script evaluation are not executed, in accordance with standard email client security sandboxes.
 */

// Suspicious / Steganographic Unicode character regexes
const ZERO_WIDTH_REGEX = /[\u200B\u200C\u200D\u2060\uFEFF]/g;
const BIDI_CONTROL_REGEX = /[\u202A-\u202E\u2066-\u2069]/g;
const UNICODE_TAGS_REGEX = /[\u{E0000}-\u{E007F}]/gu;

/**
 * Normalizes a color string to compare foreground and background colors
 */
function normalizeColor(str) {
  if (!str) return '';
  const s = str.trim().toLowerCase().replace(/\s+/g, '');
  if (s === '#ffffff' || s === '#fff' || s === 'white' || s === 'rgb(255,255,255)' || s === 'rgba(255,255,255,1)') {
    return 'white';
  }
  if (s === '#000000' || s === '#000' || s === 'black' || s === 'rgb(0,0,0)' || s === 'rgba(0,0,0,1)') {
    return 'black';
  }
  if (s === 'transparent' || s === 'rgba(0,0,0,0)' || s === 'rgba(255,255,255,0)') {
    return 'transparent';
  }
  return s;
}

/**
 * Checks if style string or attributes indicate hidden content
 */
function inspectElementHiddenStyles(styleStr = '', attrs = {}) {
  const hiddenReasons = [];
  const style = (styleStr || '').toLowerCase();

  // 1. HTML Hidden Attribute or aria-hidden
  if (attrs.hidden !== undefined && attrs.hidden !== false) {
    hiddenReasons.push('HTML hidden attribute present');
  }
  if (attrs['aria-hidden'] === 'true') {
    hiddenReasons.push('aria-hidden="true"');
  }

  if (!style) return hiddenReasons;

  // 2. Display None
  if (/display\s*:\s*none/i.test(style)) {
    hiddenReasons.push('display: none');
  }

  // 3. Visibility Hidden / Collapse
  if (/visibility\s*:\s*(hidden|collapse)/i.test(style)) {
    hiddenReasons.push('visibility: hidden');
  }

  // 4. Opacity <= 0.05
  const opacityMatch = style.match(/opacity\s*:\s*([0-9.]+)/i);
  if (opacityMatch && parseFloat(opacityMatch[1]) <= 0.05) {
    hiddenReasons.push(`opacity: ${opacityMatch[1]} <= 0.05`);
  }

  // 5. Font size 0 or <= 2px
  const fontSizeMatch = style.match(/font-size\s*:\s*([0-9.]+)(px|pt|em|rem|%|vw|vh)?/i);
  if (fontSizeMatch) {
    const val = parseFloat(fontSizeMatch[1]);
    const unit = fontSizeMatch[2] || 'px';
    if (val === 0 || (unit === 'px' && val <= 2) || (unit === 'pt' && val <= 2) || ((unit === 'em' || unit === 'rem') && val <= 0.1)) {
      hiddenReasons.push(`font-size: ${val}${unit}`);
    }
  }

  // 6. Max-height: 0 or line-height: 0 with overflow hidden
  if (/overflow\s*:\s*hidden/i.test(style)) {
    if (/(max-height|height)\s*:\s*0/i.test(style)) {
      hiddenReasons.push('height/max-height: 0 with overflow: hidden');
    }
    if (/line-height\s*:\s*0/i.test(style)) {
      hiddenReasons.push('line-height: 0 with overflow: hidden');
    }
    if (/width\s*:\s*0/i.test(style)) {
      hiddenReasons.push('width: 0 with overflow: hidden');
    }
  }

  // 7. Off-screen coordinates (large negative coordinates)
  const leftMatch = style.match(/left\s*:\s*-([0-9]+)(px|em|%)?/i);
  const topMatch = style.match(/top\s*:\s*-([0-9]+)(px|em|%)?/i);
  const textIndentMatch = style.match(/text-indent\s*:\s*-([0-9]+)(px|em|%)?/i);
  const marginLeftMatch = style.match(/margin-left\s*:\s*-([0-9]+)(px|em|%)?/i);

  if ((leftMatch && parseInt(leftMatch[1], 10) >= 500) ||
      (topMatch && parseInt(topMatch[1], 10) >= 500) ||
      (textIndentMatch && parseInt(textIndentMatch[1], 10) >= 500) ||
      (marginLeftMatch && parseInt(marginLeftMatch[1], 10) >= 500)) {
    hiddenReasons.push('off-screen coordinate displacement (negative left/top/indent)');
  }

  // 8. Color matching background (white on white, transparent color)
  const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
  const bgMatch = style.match(/(?:^|;)\s*(?:background|background-color)\s*:\s*([^;]+)/i);

  if (colorMatch) {
    const textColor = normalizeColor(colorMatch[1]);
    if (textColor === 'transparent') {
      hiddenReasons.push('color: transparent');
    } else if (bgMatch) {
      const bgColor = normalizeColor(bgMatch[1]);
      if (textColor && bgColor && textColor === bgColor) {
        hiddenReasons.push(`matching text/background color (${textColor})`);
      }
    } else if (textColor === 'white') {
      // White text without explicit dark background is a common injection vector in default white inboxes
      hiddenReasons.push('white text without dark background');
    }
  }

  return hiddenReasons;
}

/**
 * Inspects an email's raw HTML and plain text for hidden segments and anomalies.
 * 
 * @param {string} htmlContent 
 * @param {string} textContent 
 * @returns {object} Inspection result
 */
export function inspectHtmlContent(htmlContent = '', textContent = '') {
  const hiddenSegments = [];
  const findings = [];
  let threatScore = 0;

  // 1. Scan for invisible / steganographic Unicode in text
  const combinedRaw = (htmlContent || '') + ' ' + (textContent || '');
  
  const zeroWidthMatches = combinedRaw.match(ZERO_WIDTH_REGEX) || [];
  if (zeroWidthMatches.length > 0) {
    threatScore += Math.min(40, zeroWidthMatches.length * 5);
    findings.push(`Found ${zeroWidthMatches.length} zero-width invisible character(s) (U+200B/C/D/FEFF)`);
    hiddenSegments.push({
      type: 'INVISIBLE_UNICODE',
      text: `[${zeroWidthMatches.length} zero-width characters]`,
      reason: 'Zero-width characters frequently used to bypass tokenizers or hide instructions'
    });
  }

  const bidiMatches = combinedRaw.match(BIDI_CONTROL_REGEX) || [];
  if (bidiMatches.length > 0) {
    threatScore += 35;
    findings.push(`Found ${bidiMatches.length} bidirectional control character(s) (U+202A-202E)`);
    hiddenSegments.push({
      type: 'INVISIBLE_UNICODE',
      text: `[${bidiMatches.length} bidi override characters]`,
      reason: 'Bidirectional overrides used to disguise text flow and invert instruction meaning'
    });
  }

  const tagMatches = combinedRaw.match(UNICODE_TAGS_REGEX) || [];
  if (tagMatches.length > 0) {
    threatScore += 50;
    findings.push(`Found ${tagMatches.length} Unicode Tag characters (U+E0000-E007F)`);
    hiddenSegments.push({
      type: 'INVISIBLE_UNICODE',
      text: `[${tagMatches.length} Unicode tag characters]`,
      reason: 'Unicode Tag characters are invisible code points commonly used for invisible prompt injection'
    });
  }

  // If no HTML is provided, inspect text-only
  if (!htmlContent || typeof htmlContent !== 'string' || htmlContent.trim() === '') {
    const cleanText = textContent
      .replace(ZERO_WIDTH_REGEX, '')
      .replace(BIDI_CONTROL_REGEX, '')
      .replace(UNICODE_TAGS_REGEX, '')
      .trim();

    return {
      status: threatScore > 0 ? 'SUSPICIOUS' : 'CLEARED',
      score: Math.min(100, threatScore),
      visibleText: cleanText,
      aiText: textContent.trim(),
      hiddenSegments,
      findings
    };
  }

  // 2. Parse HTML with Cheerio
  const $ = cheerio.load(htmlContent, { xml: false });

  // A. Extract HTML Comments that contain text
  // Cheerio collects comments with nodeType === 8
  $('*').contents().each((_, node) => {
    if (node.type === 'comment' && node.data && node.data.trim()) {
      const commentText = node.data.trim();
      // Check if comment has meaningful text (ignoring HTML conditionals like [if mso])
      if (!commentText.startsWith('[if') && !commentText.startsWith('<![') && commentText.length > 5) {
        hiddenSegments.push({
          type: 'HTML_COMMENT',
          text: commentText,
          reason: 'HTML comment containing text hidden from reader'
        });
        findings.push(`Found text inside HTML comment (${commentText.length} chars)`);
        threatScore += 20;
      }
    }
  });

  // B. Extract <template> tag contents (never rendered by browser)
  $('template').each((_, elem) => {
    const templateContent = $(elem).text().trim() || $(elem).html() || '';
    if (templateContent.trim()) {
      hiddenSegments.push({
        type: 'TEMPLATE_TAG',
        text: templateContent.trim(),
        reason: '<template> tag content is unrendered by browser'
      });
      findings.push('Found unrendered text inside <template> tag');
      threatScore += 30;
      $(elem).remove();
    }
  });

  // B2. Extract <script> tag contents (unrendered in email clients)
  $('script').each((_, elem) => {
    const scriptContent = $(elem).text().trim();
    if (scriptContent.length > 5) {
      hiddenSegments.push({
        type: 'SCRIPT_TAG',
        text: scriptContent,
        reason: '<script> tag content is unrendered in email view'
      });
      findings.push('Found unrendered script block containing hidden text');
      threatScore += 35;
      $(elem).remove();
    }
  });

  // C. Traverse DOM elements and check CSS hiding rules
  $('*').each((_, elem) => {
    if (elem.type !== 'tag') return;
    const styleAttr = $(elem).attr('style') || '';
    const hiddenReasons = inspectElementHiddenStyles(styleAttr, elem.attribs || {});

    if (hiddenReasons.length > 0) {
      const text = $(elem).text().trim();
      if (text.length > 0) {
        hiddenSegments.push({
          type: 'CSS_HIDDEN',
          text,
          reason: hiddenReasons.join('; ')
        });
        findings.push(`Hidden element detected (${hiddenReasons[0]}): "${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`);
        threatScore += 35;
      }
      // Remove hidden element from visible DOM tree
      $(elem).remove();
    }
  });

  // Strip scripts and styles from visible output
  $('script, style, noscript, svg').remove();

  // 3. Compute `visibleText` vs `aiText`
  // visibleText: what remains after removing hidden elements, comments, and scripts
  let visibleText = $('body').text() || $.text();
  visibleText = visibleText
    .replace(ZERO_WIDTH_REGEX, '')
    .replace(BIDI_CONTROL_REGEX, '')
    .replace(UNICODE_TAGS_REGEX, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  // If visible text ended up empty but textContent exists, use cleaned textContent
  if (!visibleText && textContent) {
    visibleText = textContent
      .replace(ZERO_WIDTH_REGEX, '')
      .replace(BIDI_CONTROL_REGEX, '')
      .replace(UNICODE_TAGS_REGEX, '')
      .trim();
  }

  // aiText: Naive text extraction (as an unprotected parser would extract from full HTML/text)
  // Contains visible text plus all hidden segments
  const hiddenTextMerged = hiddenSegments.map(s => s.text).join('\n');
  const aiText = hiddenTextMerged ? `${visibleText}\n\n[HIDDEN_CONTENT]\n${hiddenTextMerged}` : visibleText;

  // Cap threat score between 0 and 100
  const normalizedScore = Math.min(100, threatScore);
  const status = normalizedScore > 30 ? 'SUSPICIOUS' : 'CLEARED';

  return {
    status,
    score: normalizedScore,
    visibleText,
    aiText,
    hiddenSegments,
    findings: findings.length > 0 ? findings : ['No hidden CSS, tags, comments, or invisible Unicode found.']
  };
}
