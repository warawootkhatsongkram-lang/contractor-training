/**
 * ระบบอบรมผู้รับเหมา — รับผลการอบรมจากหน้าเว็บ แล้วบันทึกลง Google Sheet
 * วิธีติดตั้งดูที่ gas/วิธีติดตั้ง-GAS.md
 *
 * ผูกกับ Google Sheet (Extensions → Apps Script) — ไม่ต้องแก้ ID ใดๆ
 */

const SHEET_NAME = 'ผลการอบรม';
const HEADERS = [
  'วันเวลาบันทึก', 'ชื่อ-นามสกุล', 'บริษัทผู้รับเหมา', 'เบอร์โทร',
  'รหัสหลักสูตร', 'ชื่อหลักสูตร', 'เวลาเริ่มอ่าน', 'เวลาอ่านจบ', 'ระยะเวลาอ่าน (นาที)',
  'หน้าที่เปิด', 'หน้าทั้งหมด', 'เวลายินยอม PDPA', 'รหัสอ้างอิง'
];
const REF_COL = HEADERS.length; // คอลัมน์รหัสอ้างอิง (คอลัมน์สุดท้าย) ใช้กันบันทึกซ้ำ
const ALLOWED_COURSES = ['general', 'hotwork', 'height', 'confined', 'flowchart', 'sdsf00'];

// เปิด URL ในเบราว์เซอร์เพื่อเช็คว่า deploy ถูก (ต้องเห็น {"ok":true,...})
function doGet() {
  return json({ ok: true, service: 'contractor-training', time: new Date().toISOString() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // กันสองคนส่งพร้อมกันแล้วแถวทับกัน
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action !== 'record') return json({ ok: false, error: 'action ไม่ถูกต้อง' });
    const r = validateRecord(body.record);
    const sheet = getSheet();
    // ส่งซ้ำ (เน็ตหลุดตอนรอคำตอบ) → ตอบ ok แต่ไม่เพิ่มแถว
    if (sheet.getLastRow() > 1) {
      const found = sheet.getRange(2, REF_COL, sheet.getLastRow() - 1, 1)
        .createTextFinder(r.ref).matchEntireCell(true).findNext();
      if (found) return json({ ok: true, ref: r.ref, duplicate: true });
    }
    sheet.appendRow([
      new Date(), text(r.name), text(r.company), text(r.phone),
      r.courseCode, text(r.courseName), toDate(r.startedAt), toDate(r.finishedAt), num(r.durationMin),
      num(r.pagesViewed), num(r.pagesTotal), toDate(r.consentAt), r.ref
    ]);
    console.log('[doPost] บันทึก', r.ref, r.courseCode);
    return json({ ok: true, ref: r.ref });
  } catch (err) {
    console.error('[doPost] ผิดพลาด', err);
    return json({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function validateRecord(r) {
  if (!r || typeof r !== 'object') throw new Error('ไม่มีข้อมูล');
  const need = ['ref', 'name', 'company', 'phone', 'courseCode', 'finishedAt'];
  need.forEach(function (k) { if (!r[k]) throw new Error('ข้อมูลไม่ครบ: ' + k); });
  if (!/^TR-\d{6}-[A-Z0-9]{5}$/.test(r.ref)) throw new Error('รหัสอ้างอิงไม่ถูกต้อง');
  if (ALLOWED_COURSES.indexOf(r.courseCode) < 0) throw new Error('ไม่รู้จักหลักสูตร: ' + r.courseCode);
  ['name', 'company', 'phone', 'courseName'].forEach(function (k) {
    if (String(r[k] || '').length > 200) throw new Error('ข้อมูลยาวเกินไป: ' + k);
  });
  return r;
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#EA580C').setFontColor('#FFFFFF');
    sh.getRange('A:A').setNumberFormat('dd/mm/yyyy hh:mm:ss');
    sh.getRange('G:H').setNumberFormat('dd/mm/yyyy hh:mm:ss');
    sh.getRange('L:L').setNumberFormat('dd/mm/yyyy hh:mm:ss');
  }
  return sh;
}

// ใส่ ' นำหน้า: กันเลข 0 หน้าหาย (เบอร์โทร) และกันสูตรแฝง (=, +, -, @)
function text(v) { return "'" + String(v == null ? '' : v); }
function num(v) { const n = Number(v); return isFinite(n) ? n : ''; }
function toDate(iso) { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d; }
function json(x) {
  return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON);
}

// ทดสอบใน editor: เลือกฟังก์ชันนี้ → Run → ดูแถวใหม่ใน Sheet (ลบแถวทดสอบทิ้งได้)
function testDoPost() {
  const res = doPost({ postData: { contents: JSON.stringify({ action: 'record', record: {
    ref: 'TR-261007-TEST1', name: 'ทดสอบ ระบบ', company: 'หจก. ทดสอบ', phone: '0812345678',
    courseCode: 'sdsf00', courseName: 'SD-SF-00 ข้อปฏิบัติด้านความปลอดภัย', startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(), durationMin: 3, pagesViewed: 3, pagesTotal: 3, consentAt: new Date().toISOString()
  } }) } });
  console.log(res.getContent());
}
