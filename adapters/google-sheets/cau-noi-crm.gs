/**
 * CẦU NỐI CRM — HUY HOÀNG ROBOT × Google Sheets
 * Dán toàn bộ file này vào Apps Script của Google Sheet (Extensions → Apps Script)
 * rồi Deploy dạng Web app. Xem file HUONG-DAN-CAI-DAT.md kèm theo.
 */

var TOKEN = "THAY_BANG_KHOA_BI_MAT_CUA_BAN"; // khóa bảo mật — KHÔNG chia sẻ

var MAXR = 299; // số dòng dữ liệu (khớp với file gốc: dòng 2-300)

function doGet() {
  return out({ ok: true, service: "HHR-CRM-Bridge", time: new Date().toISOString() });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    if (req.token !== TOKEN) return out({ ok: false, error: "unauthorized" });
    var actions = {
      login: login, names: names, getData: getData,
      addDeal: addDeal, updateDeal: updateDeal,
      addReport: addReport, updateReport: updateReport, addHistory: addHistory
    };
    var fn = actions[req.action];
    if (!fn) return out({ ok: false, error: "unknown action: " + req.action });
    return out(fn(req.payload || {}));
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }

// Danh bạ: CAI DAT A19:E33 — A tên, B khu vực, C leader, D mã PIN, E vai trò (Sales/Leader/Admin)
function rosterRows() {
  return ss().getSheetByName("CAI DAT").getRange("A19:E33").getDisplayValues()
    .filter(function (r) { return String(r[0]).trim() !== ""; });
}

function names() {
  return { ok: true, names: rosterRows().map(function (r) { return r[0]; }) };
}

function login(p) {
  var rows = rosterRows();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[0]).trim() === String(p.name).trim()) {
      if (String(r[3]).trim() === "" ) return { ok: false, error: "Tài khoản chưa được cấp mã PIN — liên hệ Leader" };
      if (String(r[3]).trim() !== String(p.pin).trim()) return { ok: false, error: "Sai mã PIN" };
      return { ok: true, user: { name: r[0], region: r[1], role: (r[4] || "Sales").trim() || "Sales" } };
    }
  }
  return { ok: false, error: "Không tìm thấy tên trong danh sách" };
}

function getData() {
  var s = ss();
  var deals = s.getSheetByName("DEALS").getRange(2, 1, MAXR, 20).getDisplayValues()
    .map(function (r, i) { return { row: i + 2, v: r }; })
    .filter(function (d) { return String(d.v[0]).trim() !== ""; });
  var reports = s.getSheetByName("BAO CAO").getRange(2, 1, MAXR, 12).getDisplayValues()
    .map(function (r, i) { return { row: i + 2, v: r }; })
    .filter(function (d) { return String(d.v[1]).trim() !== ""; });
  var cd = s.getSheetByName("CAI DAT");
  return {
    ok: true,
    deals: deals,
    reports: reports,
    settings: {
      nguong: cd.getRange("B2:B5").getDisplayValues().map(function (r) { return Number(r[0]) || 0; }),
      stages: cd.getRange("A8:B14").getDisplayValues(),
      loaiBC: cd.getRange("D8:D13").getDisplayValues().map(function (r) { return r[0]; }).filter(String),
      khuVuc: cd.getRange("F8:F11").getDisplayValues().map(function (r) { return r[0]; }).filter(String),
      lyDoSkip: cd.getRange("H8:H13").getDisplayValues().map(function (r) { return r[0]; }).filter(String)
    },
    roster: rosterRows().map(function (r) { return { name: r[0], region: r[1], role: (r[4] || "Sales").trim() || "Sales" }; })
  };
}

function firstEmptyRow(sheet) {
  var vals = sheet.getRange(2, 1, MAXR, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === "") return i + 2;
  }
  throw "Sheet đã đầy — liên hệ quản trị để mở rộng";
}

// Thêm deal: chỉ ghi vào các cột nhập tay, không đụng cột công thức
function addDeal(p) {
  var sh = ss().getSheetByName("DEALS");
  var r = firstEmptyRow(sh);
  sh.getRange(r, 1, 1, 7).setValues([[p.maDeal, p.ngayTao, p.khach, p.khuVuc, p.sales, p.stage, p.ngayVaoStage]]);
  if (p.hoatDong) sh.getRange(r, 9).setValue(p.hoatDong);
  if (p.followUp) sh.getRange(r, 11).setValue(p.followUp);
  sh.getRange(r, 12).setValue(p.skip || "Không");
  if (p.ghiChu) sh.getRange(r, 20).setValue(p.ghiChu);
  return { ok: true, row: r };
}

var DEAL_COLS = { stage: 6, ngayVaoStage: 7, hoatDong: 9, followUp: 11, skip: 12, lyDoSkip: 13, duyetSkip: 14, ketQua: 19, ghiChu: 20 };

function findDealRow(maDeal) {
  var vals = ss().getSheetByName("DEALS").getRange(2, 1, MAXR, 1).getDisplayValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === String(maDeal).trim()) return i + 2;
  }
  throw "Không tìm thấy deal " + maDeal;
}

function updateDeal(p) {
  var sh = ss().getSheetByName("DEALS");
  var r = findDealRow(p.maDeal);
  for (var k in p.fields) {
    if (DEAL_COLS[k]) sh.getRange(r, DEAL_COLS[k]).setValue(p.fields[k]);
  }
  return { ok: true, row: r };
}

function addReport(p) {
  var sh = ss().getSheetByName("BAO CAO");
  var vals = sh.getRange(2, 2, MAXR, 1).getValues();
  var r = -1;
  for (var i = 0; i < vals.length; i++) { if (String(vals[i][0]) === "") { r = i + 2; break; } }
  if (r < 0) throw "Sheet BAO CAO đã đầy";
  sh.getRange(r, 1, 1, 12).setValues([[p.ngayNop, p.maDeal, p.khach, p.sales, p.khuVuc, p.loai, p.stage, p.link, p.phienBan, p.trangThai, p.nguoiDuyet || "", p.ghiChu || ""]]);
  return { ok: true, row: r };
}

function updateReport(p) {
  var sh = ss().getSheetByName("BAO CAO");
  var check = sh.getRange(p.row, 2).getDisplayValue();
  if (String(check).trim() !== String(p.maDeal).trim()) throw "Dòng báo cáo không khớp — tải lại trang";
  sh.getRange(p.row, 10).setValue(p.trangThai);
  sh.getRange(p.row, 11).setValue(p.nguoiDuyet || "");
  if (p.lyDo !== undefined) sh.getRange(p.row, 12).setValue(p.lyDo);
  return { ok: true };
}

function addHistory(p) {
  var sh = ss().getSheetByName("LICH SU STAGE");
  var vals = sh.getRange(2, 2, MAXR, 1).getValues();
  var r = -1;
  for (var i = 0; i < vals.length; i++) { if (String(vals[i][0]) === "") { r = i + 2; break; } }
  if (r < 0) throw "Sheet LICH SU STAGE đã đầy";
  sh.getRange(r, 1, 1, 6).setValues([[p.ngay, p.maDeal, p.sales, p.tuStage, p.sangStage, p.lyDo || ""]]);
  return { ok: true };
}
