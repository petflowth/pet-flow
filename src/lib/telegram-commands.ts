import { bookingsForDate, listBookings } from "@/lib/bookings-store";
import { searchCustomers, listCustomers } from "@/lib/customers-store";
import { todayFinance, monthFinance } from "@/lib/finance-store";
import { salesSummary } from "@/lib/invoices-store";
import { adminDashboardStats, bookingsForMonth } from "@/lib/admin-stats";

import { parseTelegramCommand } from "@/lib/telegram";

export async function handleTelegramCommand(
  text: string,
  _chatId?: number | string
) {
  const today = new Date().toISOString().slice(0, 10);
  const ym = today.slice(0, 7);
  const { command, payload } = parseTelegramCommand(text);

  if (text === "/help" || command === "/help") {
    return {
      html: true,
      message:
        `🐱 <b>วิธีใช้ CatCha Bot</b>\n\n` +
        `👇 กดปุ่มเมนูด้านล่างได้เลย\n` +
        `📅 นัดวันนี้ · ⏳ คิวรอยืนยัน · 🗓️ ตารางเดือน\n` +
        `💰 ยอดขาย · 📒 การเงิน · 👥 ลูกค้าล่าสุด\n\n` +
        `ค้นหา: พิมพ์ <code>/search ชื่อ</code>\n` +
        `ตัวอย่าง: <code>/search ส้ม</code>`,
    };
  }

  if (command === "/today") {
    const list = await bookingsForDate(today);
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

  if (command === "/month") {
    const list = await bookingsForMonth(ym);
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

  if (command === "/queue") {
    const pending = (await listBookings()).filter((b) => b.status === "pending");
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

  if (command === "/sales") {
    const s = await salesSummary(today, today);
    const stats = await adminDashboardStats();
    return {
      message:
        `💰 ยอดขายวันนี้ (${today})\n` +
        `รับชำระ: ${s.total.toLocaleString()} บาท (${s.count} บิล)\n` +
        `รอชำระ: ${s.pending} บิล\n` +
        `นัดวันนี้: ${stats.todayAppointments} · รอยืนยัน: ${stats.queue}`,
    };
  }

  if (command === "/finance") {
    const f = await todayFinance();
    const m = await monthFinance(ym);
    return {
      message:
        `📒 การเงินวันนี้\n` +
        `รายรับ: ${f.income.toLocaleString()} บาท\n` +
        `รายจ่าย: ${f.expense.toLocaleString()} บาท\n` +
        `สุทธิ: ${f.net.toLocaleString()} บาท\n\n` +
        `เดือนนี้สุทธิ: ${m.net.toLocaleString()} บาท`,
    };
  }

  if (command === "/search") {
    const q = payload?.trim() || "";
    if (!q) return { message: "พิมพ์ /search ชื่อลูกค้าหรือชื่อแมว" };
    const found = await searchCustomers(q);
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

  if (command === "/customers") {
    const all = (await listCustomers()).slice(0, 10);
    return {
      message: all
        .map((c, i) => `${i + 1}. ${c.name} · ${c.cats[0]?.name || "-"}`)
        .join("\n"),
    };
  }

  return {
    html: true,
    message: "กดปุ่มเมนูด้านล่าง หรือพิมพ์ <code>/help</code> ดูวิธีใช้",
  };
}
