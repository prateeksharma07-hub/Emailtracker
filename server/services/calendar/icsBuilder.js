import { DateTime } from 'luxon';

/**
 * RFC 5545 Section 3.1: Line folding at 75 octets without splitting UTF-8 multibyte characters
 */
export function foldLine(line) {
  if (!line || typeof line !== 'string') return '';
  const maxBytes = 75;
  const buf = Buffer.from(line, 'utf8');
  if (buf.length <= maxBytes) return line;

  const lines = [];
  let currentLineBytes = 0;
  let currentLineChars = '';
  let isFirst = true;

  // Process Unicode characters (handles multi-byte and surrogate pairs cleanly)
  for (const char of Array.from(line)) {
    const charBytes = Buffer.byteLength(char, 'utf8');
    const limit = isFirst ? maxBytes : (maxBytes - 1); // 1 byte reserved for leading space on continuation lines

    if (currentLineBytes + charBytes > limit && currentLineBytes > 0) {
      lines.push(isFirst ? currentLineChars : ' ' + currentLineChars);
      currentLineChars = char;
      currentLineBytes = charBytes;
      isFirst = false;
    } else {
      currentLineChars += char;
      currentLineBytes += charBytes;
    }
  }

  if (currentLineChars.length > 0) {
    lines.push(isFirst ? currentLineChars : ' ' + currentLineChars);
  }

  return lines.join('\r\n');
}

/**
 * Escapes characters per RFC 5545 Section 3.3.11:
 * - Backslash (\) -> \\
 * - Semicolon (;) -> \;
 * - Comma (,) -> \,
 * - Line breaks -> \n
 * Also removes unescaped control characters to prevent header injection.
 */
export function escapeIcsText(text) {
  if (!text || typeof text !== 'string') return '';
  // Strip dangerous control characters (except newline/tab)
  const sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');

  return sanitized
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Formats ISO UTC string into RFC 5545 DTSTAMP/DTSTART UTC format: YYYYMMDDTHHMMSSZ
 */
export function formatIcsUtc(isoString) {
  const dt = DateTime.fromISO(isoString, { zone: 'utc' });
  if (!dt.isValid) {
    return DateTime.now().toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
  }
  return dt.toFormat("yyyyMMdd'T'HHmmss'Z'");
}

/**
 * Formats ISO string into RFC 5545 VALUE=DATE format: YYYYMMDD
 */
export function formatIcsDate(isoString, userTz = 'Asia/Kolkata') {
  const dt = DateTime.fromISO(isoString, { zone: 'utc' }).setZone(userTz);
  if (!dt.isValid) {
    return DateTime.now().setZone(userTz).toFormat('yyyyMMdd');
  }
  return dt.toFormat('yyyyMMdd');
}

/**
 * Builds RFC 5545 VEVENT component lines for a single task
 */
export function buildVEvent(task, options = {}) {
  const { userReminderPrefs = { days_before: 1, hours_before: 1 } } = options;
  const userTz = task.due_tz || 'Asia/Kolkata';
  const nowUtc = DateTime.now().toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
  const isAllDay = Boolean(task.due_all_day);

  const lines = ['BEGIN:VEVENT'];

  // Stable UID for idempotency & updates in user calendar
  lines.push(`UID:task-${task.id || 'default'}@mailmind.local`);
  lines.push(`DTSTAMP:${nowUtc}`);

  if (isAllDay) {
    const startDate = formatIcsDate(task.due_at, userTz);
    // End date is exclusive in RFC 5545 for all-day events -> next day
    const startDt = DateTime.fromISO(task.due_at, { zone: 'utc' }).setZone(userTz);
    const endDt = startDt.isValid ? startDt.plus({ days: 1 }) : DateTime.now().setZone(userTz).plus({ days: 1 });
    const endDate = endDt.toFormat('yyyyMMdd');

    lines.push(`DTSTART;VALUE=DATE:${startDate}`);
    lines.push(`DTEND;VALUE=DATE:${endDate}`);
  } else {
    const startUtc = formatIcsUtc(task.due_at);
    // Default duration: 1 hour
    const startDt = DateTime.fromISO(task.due_at, { zone: 'utc' });
    const endUtc = startDt.isValid
      ? startDt.plus({ hours: 1 }).toFormat("yyyyMMdd'T'HHmmss'Z'")
      : startUtc;

    lines.push(`DTSTART:${startUtc}`);
    lines.push(`DTEND:${endUtc}`);
  }

  // Summary / Title
  lines.push(`SUMMARY:${escapeIcsText(task.task_title || 'MailMind Task')}`);

  // Construct rich description
  const descParts = [];
  if (task.deadline_kind) {
    descParts.push(`Kind: ${task.deadline_kind.toUpperCase()}`);
  }
  if (task.email_subject) {
    descParts.push(`Email Subject: ${task.email_subject}`);
  }
  if (task.email_sender) {
    descParts.push(`From: ${task.email_sender}`);
  }
  if (task.due_source_flagged) {
    descParts.push(`SECURITY NOTICE: Source email was flagged as SUSPICIOUS by MailMind Shield.`);
  }
  descParts.push(`Note: Best-effort AI deadline extraction. Verify dates before relying.`);

  lines.push(`DESCRIPTION:${escapeIcsText(descParts.join('\n\n'))}`);
  lines.push('STATUS:CONFIRMED');

  // Add standard VALARM reminders based on user prefs
  const daysBefore = userReminderPrefs.days_before !== undefined ? userReminderPrefs.days_before : 1;
  const hoursBefore = userReminderPrefs.hours_before !== undefined ? userReminderPrefs.hours_before : 1;

  if (daysBefore > 0) {
    lines.push('BEGIN:VALARM');
    lines.push(`TRIGGER:-P${daysBefore}D`);
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:${escapeIcsText(`Reminder: ${daysBefore} day before ${task.task_title}`)}`);
    lines.push('END:VALARM');
  }

  if (hoursBefore > 0) {
    lines.push('BEGIN:VALARM');
    lines.push(`TRIGGER:-PT${hoursBefore}H`);
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:${escapeIcsText(`Reminder: ${hoursBefore} hour before ${task.task_title}`)}`);
    lines.push('END:VALARM');
  }

  lines.push('END:VEVENT');
  return lines;
}

/**
 * Builds a complete RFC 5545 VCALENDAR ICS string containing one or more task VEVENTs
 */
export function buildIcsCalendar(tasks, options = {}) {
  const taskList = Array.isArray(tasks) ? tasks.filter(t => Boolean(t.due_at)) : [];

  const rawLines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//MailMind AI//Calendar Export 2.0//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:MailMind AI Deadlines'
  ];

  for (const task of taskList) {
    const eventLines = buildVEvent(task, options);
    rawLines.push(...eventLines);
  }

  rawLines.push('END:VCALENDAR');

  // Apply RFC 5545 line folding and join with CRLF
  const foldedLines = rawLines.map(foldLine);
  return foldedLines.join('\r\n') + '\r\n';
}

/**
 * Generates a zero-scope Google Calendar Web template URL
 * Opens directly in the user's browser without requiring calendar OAuth scopes
 */
export function generateGoogleCalendarUrl({
  title,
  dueAt,
  allDay = false,
  dueTz = 'Asia/Kolkata',
  details = '',
  location = ''
}) {
  if (!dueAt) return null;

  let datesParam = '';
  if (allDay) {
    const startDt = DateTime.fromISO(dueAt, { zone: 'utc' }).setZone(dueTz);
    const endDt = startDt.plus({ days: 1 });
    datesParam = `${startDt.toFormat('yyyyMMdd')}/${endDt.toFormat('yyyyMMdd')}`;
  } else {
    const startDt = DateTime.fromISO(dueAt, { zone: 'utc' });
    const endDt = startDt.plus({ hours: 1 });
    datesParam = `${startDt.toFormat("yyyyMMdd'T'HHmmss'Z'")}/${endDt.toFormat("yyyyMMdd'T'HHmmss'Z'")}`;
  }

  const queryParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'MailMind Task',
    dates: datesParam,
    details: `${details ? details + '\n\n' : ''}(Exported via MailMind AI - best-effort, verify before relying)`,
    location: location || ''
  });

  return `https://calendar.google.com/calendar/render?${queryParams.toString()}`;
}
