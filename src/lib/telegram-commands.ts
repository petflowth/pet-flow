import { bookingsForDate, listBookings } from "@/lib/bookings-store";
import { searchCustomers, listCustomers, customerSummary } from "@/lib/customers-store";
import {
  inactiveCustomerStats,
  listInactiveCustomers,
  sendCustomerFollowUp,
  sendInactiveFollowUps,
} from "@/lib/customer-crm";
import { getSiteConfig } from "@/lib/config-store";
import { todayFinance, monthFinance } from "@/lib/finance-store";
import { salesSummary } from "@/lib/invoices-store";
import { adminDashboardStats, bookingsForMonth } from "@/lib/admin-stats";
import { getActivePromos, customerTierLabels } from "@/lib/promos-store";

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
        `💰 ยอดขาย · 📒 การเงิน · 😴 ลูกค้าหายไป\n` +
        `✨ โปร · 👥 ลูกค้าล่าสุด\n\n` +
        `ค้นหา: <code>/search ชื่อ</code>\n` +
        `ส่งตามลูกค้า: <code>/followup ชื่อ</code> หรือ <code>/followup all</code>\n` +
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
    const lines: string[] = [];
    for (const c of found.slice(0, 8)) {
      const summary = await customerSummary(c.id);
      const visits = summary?.visits ?? 0;
      const tiers = customerTierLabels(c, visits).map((t) => t.label).join(", ");
      lines.push(
        `${lines.length + 1}. ${c.name}${c.isMember ? " 💎" : ""}\n` +
          `   แมว: ${c.cats.map((cat) => cat.name).join(", ")}\n` +
          `   Tier: ${tiers || "-"}\n` +
          `   เครดิต: ${c.memberCredit} บาท`
      );
    }
    return { message: lines.join("\n\n") };
  }

  if (command === "/inactive") {
    const config = await getSiteConfig();
    const inactive = await listInactiveCustomers();
    const stats = await inactiveCustomerStats();
    if (!inactive.length) {
      return {
        message: `😴 ไม่มีลูกค้าที่หายไปเกิน ${config.crm.inactiveDays} วัน`,
      };
    }
    return {
      message:
        `😴 ลูกค้าหายไปนาน (≥${config.crm.inactiveDays} วัน)\n` +
        `รวม ${stats.total} คน · มี LINE ${stats.withLine} · ส่งตามได้ ${stats.canFollowUp}\n\n` +
        inactive
          .slice(0, 10)
          .map(
            (row, i) =>
              `${i + 1}. ${row.customer.name} · ${row.daysSinceVisit} วัน\n` +
              `   แมว: ${row.customer.cats.map((c) => c.name).join(", ") || "-"}\n` +
              `   ${row.hasLine ? (row.canFollowUp ? "📲 ส่งตามได้" : "⏳ ส่งไปแล้ว") : "❌ ไม่มี LINE"}`
          )
          .join("\n\n") +
        (inactive.length > 10 ? `\n\n…และอีก ${inactive.length - 10} คน` : "") +
        `\n\nส่งตามทั้งหมด: /followup all`,
    };
  }

  if (command === "/followup") {
    const target = payload?.trim().toLowerCase() || "";
    if (!target) {
      return {
        message:
          "พิมพ์ /followup all เพื่อส่งตามลูกค้าที่หายไปทั้งหมด\n" +
          "หรือ /followup ชื่อลูกค้า เพื่อส่งรายคน",
      };
    }

    if (target === "all") {
      const result = await sendInactiveFollowUps({ limit: 20 });
      if (!result.eligible) {
        return { message: "😴 ไม่มีลูกค้าที่ส่งตามได้ตอนนี้ (ต้องมี LINE และยังไม่เคยส่งในรอบ cooldown)" };
      }
      const errLines = result.errors
        .slice(0, 3)
        .map((e) => `· ${e.name}: ${e.error}`)
        .join("\n");
      return {
        message:
          `📲 ส่งข้อความตามลูกค้าแล้ว ${result.sent}/${result.total} คน` +
          (result.errors.length ? `\n\nไม่สำเร็จ:\n${errLines}` : ""),
      };
    }

    const found = await searchCustomers(payload!.trim());
    if (!found.length) return { message: `ไม่พบ "${payload}"` };
    const c = found[0];
    const result = await sendCustomerFollowUp(c.id);
    if (!result.ok) return { message: `❌ ${c.name}: ${result.error}` };
    return { message: `✅ ส่งข้อความตาม ${c.name} แล้ว` };
  }

  if (command === "/promos") {
    const promos = await getActivePromos();
    if (!promos.length) return { message: "✨ ยังไม่มีโปรที่เปิดใช้งาน" };
    return {
      message:
        `✨ โปรที่เปิดอยู่ (${promos.length})\n\n` +
        promos
          .slice(0, 8)
          .map(
            (p, i) =>
              `${i + 1}. ${p.title.th}\n` +
              `   ${p.kind === "customer" ? "🏠 หน้าแรก" : "📋 หน้าโปร"} · ${p.tiers.join(", ")}`
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
