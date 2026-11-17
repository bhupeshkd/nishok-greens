/**
 * Nishok Greens — website leads → Google Sheet
 *
 * Paste this whole file into Extensions → Apps Script of your leads sheet,
 * then Deploy → New deployment → Web app (Execute as: Me, Access: Anyone).
 * Full steps: google-sheet/SETUP.md
 */

// ---- Settings -------------------------------------------------------------
const SHEET_NAME = 'Leads';                 // tab is created automatically if missing
const NOTIFY_EMAIL = '';                    // e.g. 'sales@nishokgreens.com' — leave '' for no emails
const TIMEZONE = 'Asia/Kolkata';

// Sheet columns, in order: [header, field name sent by the website]
const COLUMNS = [
  ['Received (IST)', '_received'],
  ['Form', 'form_type'],
  ['Name', 'name'],
  ['Mobile', 'phone'],
  ['Email', 'email'],
  ['Interested In', 'interest'],
  ['Configuration', 'configuration'],
  ['Preferred Date', 'date'],
  ['Time Slot', 'slot'],
  ['Consent', 'consent'],
  ['UTM Source', 'utm_source'],
  ['UTM Medium', 'utm_medium'],
  ['UTM Campaign', 'utm_campaign'],
  ['UTM Term', 'utm_term'],
  ['UTM Content', 'utm_content'],
  ['GCLID', 'gclid'],
  ['FBCLID', 'fbclid'],
  ['Referrer', 'referrer'],
  ['Page', 'page'],
  ['Submitted (browser)', 'submitted_at'],
  ['Lead Status', '_status'],               // for your sales team to update
  ['Notes', '_notes'],
];
const MAX_FIELD_LENGTH = 500;
// ---------------------------------------------------------------------------

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const data = parseBody_(e);

    // Spam trap / minimum fields: ignore quietly
    if (data._gotcha || !data.name || !data.phone) return json_({ success: false, message: 'Missing required fields' });

    lock.waitLock(10000); // two leads at the same moment must not overwrite each other's row
    const sheet = getSheet_();
    data._received = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    data._status = 'New';

    const row = COLUMNS.map(([, key]) => clean_(data[key]));
    sheet.appendRow(row);

    if (NOTIFY_EMAIL) notify_(data);
    return json_({ success: true });
  } catch (err) {
    console.error(err);
    return json_({ success: false, message: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

// Visiting the web-app URL in a browser shows this: a quick "is it live?" check
function doGet() {
  return json_({ success: true, message: 'Nishok Greens lead endpoint is live.' });
}

// The site sends JSON as text/plain (needed for Apps Script); also accept normal form posts
function parseBody_(e) {
  const raw = e && e.postData && e.postData.contents;
  if (raw) {
    try { return JSON.parse(raw); } catch (_) { /* fall through to form fields */ }
  }
  return (e && e.parameter) || {};
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    const headers = COLUMNS.map(([h]) => h);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#132218').setFontColor('#F5F2EB');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Trim, cap length, and stop spreadsheet formula injection (=, +, -, @ at the start)
function clean_(value) {
  if (value === undefined || value === null) return '';
  let s = String(value).trim().slice(0, MAX_FIELD_LENGTH);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function notify_(d) {
  const lines = COLUMNS
    .filter(([, key]) => d[key] && key.charAt(0) !== '_')
    .map(([h, key]) => h + ': ' + String(d[key]).slice(0, MAX_FIELD_LENGTH));
  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: 'New lead · ' + (d.form_type || 'Enquiry') + ' · ' + String(d.name).slice(0, 80),
    body: lines.join('\n') + '\n\nOpen the sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
