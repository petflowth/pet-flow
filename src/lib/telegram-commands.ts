import { bookingsForDate, listBookings } from "@/lib/bookings-store";
import { searchCustomers, listCustomers } from "@/lib/customers-store";
import { todayFinance, monthFinance } from "@/lib/finance-store";
import { salesSummary } from "@/lib/invoices-store";
import { adminDashboardStats, bookingsForMonth } from "@/lib/admin-stats";

export function handleTelegramCommand(text: string) {
  const today = new Date().toISOString().slice(0, 10);
  const ym = today.slice(0, 7);

  if (text === "/start") {
    return {
      html: true,
      message:
        `🐱 <b>CatCha Hotel Bot</b>\n\n` +
        `คำสั่ง:\n` +
        `/today — นัดวันนี้\n` +
        `/month — ตารางเดือนนี้\n` +
        `/queue — คิวรอยืนยัน\n` +
        `/sales — ยอดขายวันนี้\n` +
        `/search ชื่อ — ค้นหาลูกค้า\n` +
        `/finance — รายรับรายจ่ายวันนี้\n` +
        `/help — ดูคำสั่ง`,
    };
  }

  if (text === "/help") {
    return {
      html: true,
      message:
        `คำสั่ง CatCha Bot:\n` +
        `/today /month /queue /sales /search /finance\n` +
        `ตัวอย่าง: /search ส้ม`,
    };
  }

  if (text === "/today") {
    const list = bookingsForDate(today);
    if (!list.length) return { message: "📅 วันนี้ยังไม่มีนัดในระบบ" };
    return {
      message:
        `📅 นัดวันนี้ (${today})\n\n` +
        list
          .map(
            (b, i) =>
              `${i + 1}. ${b.catName} · ${b.customerName}\n` +
              `   ${b.service === "room" ? "ห้องพัก" : "อาบน้ำ"} ${b.time || ""} · ${b.status === "confirmed" ? "✅" : "⏳"}`
          )
          .join("\n\n"),
    };
  }

  if (text === "/month") {
    const list = bookingsForMonth(ym);
    const byDay = new Map<string, number>();
    for (const b of list) {
      const d = b.date || b.checkin || "";
      if (d) byDay.set(d, (byDay.get(d) || 0) + 1);
    }
    const lines = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, n]) => `${d}: ${n} นัด`)
      .join("\n");
    return {
      message: `🗓️ ตาราง ${ym}\nรวม ${list.length} นัด\n\n${lines || "ยังไม่มีนัด"}`,
    };
  }

  if (text === "/queue") {
    const pending = listBookings().filter((b) => b.status === "pending");
    if (!pending.length) return { message: "⏳ ไม่มีคิวรอยืนยัน" };
    return {
      message:
        `⏳ คิวรอยืนยัน (${pending.length})\n\n` +
        pending
          .map(
            (b, i) =>
              `${i + 1}. ${b.catName} · ${b.customerName}\n   ${b.date || b.checkin} ${b.time || ""}`
          )
          .join("\n\n"),
    };
  }

  if (text === "/sales") {
    const s = salesSummary(today, today);
    const stats = adminDashboardStats();
    return {
      message:
        `💰 ยอดขายวันนี้ (${today})\n` +
        `รับชำระ: ${s.total.toLocaleString()} บาท (${s.count} บิล)\n` +
        `รอชำระ: ${s.pending} บิล\n` +
        `นัดวันนี้: ${stats.todayAppointments} · รอยืนยัน: ${stats.queue}`,
    };
  }

  if (text === "/finance") {
    const f = todayFinance();
    const m = monthFinance(ym);
    return {
      message:
        `📒 การเงินวันนี้\n` +
        `รายรับ: ${f.income.toLocaleString()} บาท\n` +
        `รายจ่าย: ${f.expense.toLocaleString()} บาท\n` +
        `สุทธิ: ${f.net.toLocaleString()} บาท\n\n` +
        `เดือนนี้สุทธิ: ${m.net.toLocaleString()} บาท`,
    };
  }

  if (text.startsWith("/search ")) {
    const q = text.slice(8).trim();
    if (!q) return { message: "พิมพ์ /search ชื่อลูกค้าหรือชื่อแมว" };
    const found = searchCustomers(q);
    if (!found.length) return { message: `ไม่พบ "${q}"` };
    return {
      message: found
        .slice(0, 8)
        .map(
          (c, i) =>
            `${i + 1}. ${c.name}${c.isMember ? " 💎" : ""}\n` +
            `   แมว: ${c.cats.map((cat) => cat.name).join(", ")}\n` +
            `   เครดิต: ${c.memberCredit} บาท`
        )
        .join("\n\n"),
    };
  }

  if (text === "/customers") {
    const all = listCustomers().slice(0, 10);
    return {
      message: all
        .map((c, i) => `${i + 1}. ${c.name} · ${c.cats[0]?.name || "-"}`)
        .join("\n"),
    };
  }

  return { message: "พิมพ์ /help ดูคำสั่ง" };
}
