/**
 * 10 TEST CASE BẮT BUỘC (docs/TEST-CASES.md) + các ca bổ sung.
 * Chạy: npm test  (Node ≥ 22.6, không cần cài thêm gì)
 */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { MemoryRepository } from "../../adapters/memory/memory-repository.ts";
import { SalesReportService } from "../services.ts";
import { computeDealStatus, buildReminderMessage } from "../status.ts";
import { complianceBySales, monthlyReportMatrix, attentionItems } from "../analytics.ts";
import { BusinessError } from "../types.ts";
import type { User, Deal } from "../types.ts";

const sales: User = { id: "u-hoang", name: "Chu Huy Hoàng", region: "Miền Bắc", role: "Sales" };
const sales2: User = { id: "u-tuan", name: "Nguyễn Minh Tuấn", region: "Miền Bắc", role: "Sales" };
const leader: User = { id: "u-minh", name: "Lê Đức Minh", region: "Toàn Quốc", role: "Leader" };
const leaderMN: User = { id: "u-phuong", name: "Bùi Thúy Phương", region: "Miền Nam", role: "Leader" };

let repo: MemoryRepository;
let svc: SalesReportService;
let TODAY = "2026-08-21";

async function expectError(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
  } catch (e) {
    assert.ok(e instanceof BusinessError, `phải là BusinessError, nhận: ${e}`);
    assert.equal((e as BusinessError).code, code, `mã lỗi mong đợi ${code}, nhận ${(e as BusinessError).code}: ${(e as Error).message}`);
    return;
  }
  assert.fail(`phải ném lỗi ${code}`);
}

async function dealAt(stage: Deal["stage"], user = sales): Promise<Deal> {
  const d = await svc.createDeal(user, { customerName: "Nhà máy Test", stage: "Liên hệ mới" });
  // đi từng bước hợp lệ tới stage mong muốn (không có stage nào trước Demo cần báo cáo)
  const path: Deal["stage"][] = ["Cơ hội", "Khảo sát", "Demo", "Đàm phán", "Đồng ý mua"];
  for (const s of path) {
    if ((await repo.getDeal(d.id))!.stage === stage) break;
    if (s === "Đàm phán") await svc.submitReport(user, d.id, "BC Demo", "https://drive.google.com/x");
    await svc.changeStage(user, d.id, s);
    if (s === stage) break;
  }
  return (await repo.getDeal(d.id))!;
}

beforeEach(() => {
  repo = new MemoryRepository();
  repo.users = [sales, sales2, leader, leaderMN];
  TODAY = "2026-08-21";
  svc = new SalesReportService(repo, () => TODAY);
});

describe("TEST 1–2: chuyển stage hợp lệ / bị chặn", () => {
  test("TEST 1: Khảo sát → Demo thành công (không cần báo cáo)", async () => {
    const d = await dealAt("Khảo sát");
    await svc.changeStage(sales, d.id, "Demo");
    assert.equal((await repo.getDeal(d.id))!.stage, "Demo");
    assert.equal(repo.history.at(-1)!.toStage, "Demo");
  });

  test("TEST 2: Khảo sát → Đàm phán bị CHẶN khi chưa xin Skip Demo", async () => {
    const d = await dealAt("Khảo sát");
    await expectError(() => svc.changeStage(sales, d.id, "Đàm phán"), "SKIP_NOT_REQUESTED");
  });

  test("Không nhảy cóc: Liên hệ mới → Demo bị chặn", async () => {
    const d = await svc.createDeal(sales, { customerName: "X" });
    await expectError(() => svc.changeStage(sales, d.id, "Demo"), "STAGE_SKIP");
  });

  test("LUẬT MỚI: Demo → Đàm phán bắt buộc BC Demo; có rồi thì qua", async () => {
    const d = await dealAt("Demo");
    await expectError(() => svc.changeStage(sales, d.id, "Đàm phán"), "REPORT_MISSING");
    await svc.submitReport(sales, d.id, "BC Demo", "https://drive.google.com/demo");
    await svc.changeStage(sales, d.id, "Đàm phán");
    assert.equal((await repo.getDeal(d.id))!.stage, "Đàm phán");
  });

  test("Lùi stage luôn được phép", async () => {
    const d = await dealAt("Khảo sát");
    await svc.changeStage(sales, d.id, "Cơ hội");
    assert.equal((await repo.getDeal(d.id))!.stage, "Cơ hội");
  });
});

describe("TEST 3–5: Skip Demo", () => {
  test("TEST 3: xin Skip Demo → phải chọn lý do; 'Lý do khác' phải giải trình", async () => {
    const d = await dealAt("Khảo sát");
    await expectError(() => svc.requestSkipDemo(sales, d.id, "bừa"), "SKIP_REASON_INVALID");
    await expectError(() => svc.requestSkipDemo(sales, d.id, "Lý do khác", ""), "SKIP_EXPLANATION_REQUIRED");
    await svc.requestSkipDemo(sales, d.id, "Khách đã demo ở địa điểm khác");
    const after = (await repo.getDeal(d.id))!;
    assert.equal(after.skipDemoRequested, true);
    assert.equal(after.skipDemoApproval, "Chờ duyệt");
  });

  test("TEST 4: Leader chưa duyệt → không cho chuyển Đàm phán", async () => {
    const d = await dealAt("Khảo sát");
    await svc.requestSkipDemo(sales, d.id, "Khách không cần demo");
    await svc.submitReport(sales, d.id, "BC Skip Demo", "https://drive.google.com/skip");
    await expectError(() => svc.changeStage(sales, d.id, "Đàm phán"), "SKIP_NOT_APPROVED");
  });

  test("TEST 5: Leader duyệt + có BC Skip Demo → chuyển được; thiếu BC thì chặn", async () => {
    const d = await dealAt("Khảo sát");
    await svc.requestSkipDemo(sales, d.id, "Khách không cần demo");
    await svc.decideSkipDemo(leader, d.id, true);
    await expectError(() => svc.changeStage(sales, d.id, "Đàm phán"), "SKIP_REPORT_MISSING");
    await svc.submitReport(sales, d.id, "BC Skip Demo", "https://drive.google.com/skip");
    await svc.changeStage(sales, d.id, "Đàm phán");
    assert.equal((await repo.getDeal(d.id))!.stage, "Đàm phán");
    assert.match(repo.history.at(-1)!.reason, /Skip Demo/);
  });

  test("Leader từ chối Skip → phải đi qua Demo", async () => {
    const d = await dealAt("Khảo sát");
    await svc.requestSkipDemo(sales, d.id, "Khách không cần demo");
    await svc.decideSkipDemo(leader, d.id, false);
    await expectError(() => svc.changeStage(sales, d.id, "Đàm phán"), "SKIP_NOT_APPROVED");
  });

  test("Sales thường không được duyệt Skip; Leader khác khu vực cũng không", async () => {
    const d = await dealAt("Khảo sát");
    await svc.requestSkipDemo(sales, d.id, "Khách không cần demo");
    await expectError(() => svc.decideSkipDemo(sales2, d.id, true), "NOT_LEADER");
    await expectError(() => svc.decideSkipDemo(leaderMN, d.id, true), "NOT_LEADER");
  });

  test("Tắt requireLeaderApprovalForSkip → tự duyệt", async () => {
    repo.settings.requireLeaderApprovalForSkip = false;
    const d = await dealAt("Khảo sát");
    await svc.requestSkipDemo(sales, d.id, "Khách không cần demo");
    assert.equal((await repo.getDeal(d.id))!.skipDemoApproval, "Đã duyệt");
  });
});

describe("TEST 6–7: nhắc nhở & escalation", () => {
  test("TEST 6: quá ngưỡng ngày 3 → nhắc Sales; ngày 5 → nhắc lần 2", async () => {
    const d = await dealAt("Đàm phán");
    TODAY = "2026-08-24"; // 3 ngày sau
    let st = computeDealStatus((await repo.getDeal(d.id))!, [], repo.settings, TODAY);
    assert.equal(st.reminderLevel, 1);
    TODAY = "2026-08-26";
    st = computeDealStatus((await repo.getDeal(d.id))!, [], repo.settings, TODAY);
    assert.equal(st.reminderLevel, 2);
    assert.equal(st.health, "yellow");
  });

  test("TEST 7: ngày 7 không xử lý → escalation Leader + Deal 🔴", async () => {
    const d = await dealAt("Đàm phán");
    TODAY = "2026-08-28";
    const st = computeDealStatus((await repo.getDeal(d.id))!, [], repo.settings, TODAY);
    assert.equal(st.reminderLevel, 3);
    assert.equal(st.reminderLabel, "🔴 Báo Leader");
    assert.equal(st.health, "red");
    const msg = buildReminderMessage(sales.name, [{ deal: (await repo.getDeal(d.id))!, status: st }], TODAY);
    assert.match(msg, /7 ngày trước/);
  });

  test("Cập nhật hoạt động → reset nhắc; deal Win/Fail → không nhắc", async () => {
    const d = await dealAt("Đàm phán");
    TODAY = "2026-08-28";
    await svc.touch(sales, d.id, { note: "Đã gọi khách" });
    let st = computeDealStatus((await repo.getDeal(d.id))!, [], repo.settings, TODAY);
    assert.equal(st.reminderLevel, 0);
    await svc.closeDeal(sales, d.id, "Win");
    TODAY = "2026-09-30";
    st = computeDealStatus((await repo.getDeal(d.id))!, [], repo.settings, TODAY);
    assert.equal(st.reminderLevel, 0);
    assert.equal(st.health, null);
  });

  test("Ngưỡng cấu hình được (không hard-code)", async () => {
    repo.settings.remindDays = [1, 2, 3];
    const d = await dealAt("Cơ hội");
    TODAY = "2026-08-24";
    assert.equal(computeDealStatus((await repo.getDeal(d.id))!, [], repo.settings, TODAY).reminderLevel, 3);
  });
});

describe("TEST 8: duyệt / từ chối báo cáo", () => {
  test("TEST 8: Leader từ chối phải có lý do; Sales thấy trạng thái Từ chối", async () => {
    const d = await dealAt("Demo");
    const r = await svc.submitReport(sales, d.id, "BC Demo", "https://drive.google.com/demo");
    await expectError(() => svc.reviewReport(leader, r.id, "Từ chối", ""), "REJECT_REASON_REQUIRED");
    await svc.reviewReport(leader, r.id, "Từ chối", "Thiếu ảnh hiện trường");
    const after = (await repo.listReports(d.id))[0];
    assert.equal(after.status, "Từ chối");
    assert.equal(after.reviewNote, "Thiếu ảnh hiện trường");
    assert.ok(repo.audits.some((a) => a.action === "REPORT_REJECTED"));
    // báo cáo bị từ chối KHÔNG tính là đã nộp → vẫn chặn chuyển stage
    await expectError(() => svc.changeStage(sales, d.id, "Đàm phán"), "REPORT_MISSING");
  });

  test("Không tự duyệt báo cáo của mình; Admin thì được", async () => {
    const admin: User = { id: "u-admin", name: "Admin", region: "Toàn Quốc", role: "Admin" };
    const leaderAsSales = await svc.createDeal(leader, { customerName: "Deal của Leader" });
    const r = await svc.submitReport(leader, leaderAsSales.id, "BC Khảo sát", "https://x.y/z");
    await expectError(() => svc.reviewReport(leader, r.id, "Đã duyệt"), "SELF_REVIEW");
    await svc.reviewReport(admin, r.id, "Đã duyệt");
    assert.equal((await repo.listReports(leaderAsSales.id))[0].status, "Đã duyệt");
  });
});

describe("TEST 9: dashboard tính đúng compliance", () => {
  test("TEST 9: Required / Uploaded / Compliance theo sales", async () => {
    const a = await dealAt("Demo", sales);          // cần BC Demo — THIẾU
    const b = await dealAt("Demo", sales);          // cần BC Demo — đã nộp
    await svc.submitReport(sales, b.id, "BC Demo", "https://drive.google.com/b");
    await dealAt("Cơ hội", sales);                  // không cần báo cáo
    await dealAt("Demo", sales2);                   // sales2 thiếu
    const rows = complianceBySales(await repo.listDeals(), await repo.listReports(), repo.settings, TODAY, repo.users);
    const hoang = rows.find((r) => r.key === sales.name)!;
    assert.equal(hoang.openDeals, 3);
    assert.equal(hoang.required, 2);
    assert.equal(hoang.submitted, 1);
    assert.equal(hoang.missing, 1);
    assert.equal(hoang.rate, 0.5);
    const tuan = rows.find((r) => r.key === sales2.name)!;
    assert.equal(tuan.rate, 0);
    const minh = rows.find((r) => r.key === leader.name)!;
    assert.equal(minh.rate, null); // không có báo cáo bắt buộc → không kết luận
    assert.ok(a.id.startsWith("MB-"));
  });

  test("Ma trận tháng + Attention items", async () => {
    const d = await dealAt("Demo");
    await svc.submitReport(sales, d.id, "BC Demo", "https://drive.google.com/1");
    TODAY = "2026-09-02";
    await svc.submitReport(sales, d.id, "BC Follow-up", "https://drive.google.com/2");
    const m = monthlyReportMatrix(await repo.listReports(), 2026, [sales.name]);
    assert.equal(m[sales.name][7], 1); // tháng 8
    assert.equal(m[sales.name][8], 1); // tháng 9
    const items = attentionItems(await repo.listDeals(), await repo.listReports(), repo.settings, TODAY);
    assert.ok(items.some((i) => i.includes("chờ duyệt")));
  });
});

describe("TEST 10: versioning báo cáo", () => {
  test("TEST 10: nộp lại nhiều lần → v1, v2, v3 — không mất lịch sử", async () => {
    const d = await dealAt("Demo");
    await svc.submitReport(sales, d.id, "BC Demo", "https://drive.google.com/v1");
    await svc.submitReport(sales, d.id, "BC Demo", "https://drive.google.com/v2");
    await svc.submitReport(sales, d.id, "BC Demo", "https://drive.google.com/v3");
    const rs = await repo.listReports(d.id);
    assert.deepEqual(rs.map((r) => r.version), [1, 2, 3]);
    assert.deepEqual(rs.map((r) => r.fileUrl), ["https://drive.google.com/v1", "https://drive.google.com/v2", "https://drive.google.com/v3"]);
  });

  test("Báo cáo đã duyệt không xóa được bởi Sales", async () => {
    const d = await dealAt("Demo");
    const r = await svc.submitReport(sales, d.id, "BC Demo", "https://drive.google.com/v1");
    await svc.reviewReport(leader, r.id, "Đã duyệt");
    await expectError(() => svc.requestDeleteReport(sales, r.id, "nhầm"), "DELETE_REQUESTED");
  });
});

describe("Phân quyền & audit", () => {
  test("Sales không sửa deal người khác; Leader khu vực thì được; mọi hành động có audit", async () => {
    const d = await svc.createDeal(sales, { customerName: "Của Hoàng" });
    await expectError(() => svc.touch(sales2, d.id), "FORBIDDEN");
    await expectError(() => svc.touch(leaderMN, d.id), "FORBIDDEN");
    await svc.touch(leader, d.id, { note: "Leader check" });
    assert.ok(repo.audits.length >= 2);
    assert.equal((await svc.dealsFor(sales2)).length, 0);
    assert.equal((await svc.dealsFor(leader)).length, 1);
  });
});
