/**
 * LINE Messaging API — ส่งการ์ดเตือนลูกค้า
 * ตั้งค่า: LINE_CHANNEL_TOKEN
 */

import { formatBookingWhen, formatThaiDate } from "./format-thai-date";
import { getLineCredentials } from "./line-config";
import type { CardStyleConfig } from "./config-types";

const BRAND_GREEN = "#5A8F5A";
const BRAND_GREEN_DARK = "#4A7348";

async function lineChannelToken() {
  const creds = await getLineCredentials();
  if (!creds?.channelToken) {
    throw new Error(
      "ยังไม่ได้ตั้ง LINE — ไป Admin → ติดตั้ง → วาง Channel Access Token"
    );
  }
  return creds.channelToken;
}

function flexDetailRow(icon: string, label: string, value: string) {
  return {
    type: "box" as const,
    layout: "horizontal" as const,
    spacing: "md" as const,
    margin: "lg" as const,
    contents: [
      {
        type: "text" as const,
        text: icon,
        size: "sm" as const,
        flex: 0,
      },
      {
        type: "box" as const,
        layout: "vertical" as const,
        flex: 5,
        contents: [
          {
            type: "text" as const,
            text: label,
            size: "xxs" as const,
            color: "#9B8B7E",
          },
          {
            type: "text" as const,
            text: value,
            size: "sm" as const,
            color: "#4E3E32",
            wrap: true,
            margin: "xs" as const,
          },
        ],
      },
    ],
  };
}

export async function pushLineMessage(to: string, messages: object[]) {
  const token = await lineChannelToken();

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to, messages }),
  });

  if (!res.ok) {
    const errText = await res.text();
    let hint = errText;
    try {
      const parsed = JSON.parse(errText) as { message?: string };
      if (parsed.message?.includes("Authentication")) {
        hint = "LINE Token ผิด — ไป Admin → ติดตั้ง → LINE แล้ววาง Token ใหม่";
      } else if (parsed.message) {
        hint = parsed.message;
      }
    } catch {
      /* keep raw */
    }
    throw new Error(hint);
  }
  return { ok: true };
}

/** ส่งหลายคนพร้อมกัน (สูงสุด 500 ต่อครั้ง) */
export async function multicastLineMessage(to: string[], messages: object[]) {
  const token = await lineChannelToken();
  if (to.length === 0) return { ok: true, sent: 0 };

  const chunks: string[][] = [];
  for (let i = 0; i < to.length; i += 500) {
    chunks.push(to.slice(i, i + 500));
  }

  let sent = 0;
  for (const batch of chunks) {
    const res = await fetch("https://api.line.me/v2/bot/message/multicast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to: batch, messages }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LINE multicast: ${errText}`);
    }
    sent += batch.length;
  }
  return { ok: true, sent };
}

export function buildAppointmentConfirmFlex(booking: {
  id: string;
  catName: string;
  customerName: string;
  service: string;
  date?: string;
  time?: string;
  checkin?: string;
  checkout?: string;
  room?: string;
  notes?: string;
  confirmUrl: string;
  mapsUrl: string;
  location: string;
  businessName?: string;
}, style?: CardStyleConfig) {
  const st = style || {};
  const show = (k: string) => st.show?.[k] !== false;
  const isRoom = booking.service === "room";
  const serviceTitle = isRoom
    ? `ห้องพัก · ${booking.catName}`
    : `อาบน้ำ & กรูมมิ่ง · ${booking.catName}`;
  const dateText = isRoom
    ? formatBookingWhen({
        service: booking.service,
        checkin: booking.checkin || booking.date,
        checkout: booking.checkout,
      })
    : formatThaiDate(booking.date || booking.checkin || "");
  const timeText = isRoom
    ? booking.room
      ? `ห้อง ${booking.room}`
      : "เช็คอินตามเวลาที่ยืนยันในแอป"
    : booking.time
      ? `เวลา ${booking.time}`
      : "รอเลือกเวลาในแอป";

  const noteText =
    booking.notes?.trim() ||
    "หากมีรายละเอียดอื่นๆ เพิ่มเติม สามารถแจ้งในแชท LINE ได้เลยนะคะ";

  const altText = `ยืนยันนัด ${booking.catName} — ${dateText}`;

  return {
    type: "flex",
    altText,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: st.headerColor || BRAND_GREEN,
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: "📅 กำหนดการนัด",
            color: st.headerTextColor || "#FFFFFF",
            weight: "bold",
            size: "sm",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: serviceTitle,
            weight: "bold",
            size: st.titleSize || "lg",
            color: st.accentColor || "#5C4033",
            wrap: true,
          },
          {
            type: "text",
            text: `แจ้งกำหนดการนัด 🗓️\n${booking.customerName}`,
            size: "xs",
            color: "#A2907E",
            margin: "md",
            wrap: true,
          },
          flexDetailRow("🗓️", "วันที่", dateText),
          flexDetailRow("⏰", "เวลา / รายละเอียด", timeText),
          ...(show("location")
            ? [flexDetailRow("📍", "สถานที่", booking.location)]
            : []),
          ...(show("notes") ? [flexDetailRow("📝", "หมายเหตุ", noteText)] : []),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "12px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: st.buttonColor || BRAND_GREEN_DARK,
            height: "sm",
            action: {
              type: "uri",
              label: "🐾 ยืนยันนัด",
              uri: booking.confirmUrl,
            },
          },
          ...(show("map")
            ? [
                {
                  type: "button",
                  style: "link",
                  height: "sm",
                  action: {
                    type: "uri",
                    label: "🗺️ ดูแผนที่ / เส้นทาง",
                    uri: booking.mapsUrl,
                  },
                },
              ]
            : []),
        ],
      },
    },
  };
}

/** การ์ดเงื่อนไขก่อนเข้าพัก — มีปุ่มไปหน้ากดยอมรับ + แจ้งการดูแลเพิ่มเติม */
export function buildConsentFlex(data: {
  businessName: string;
  title: string;
  catName: string;
  checkin?: string;
  checkout?: string;
  room?: string;
  terms?: string[];
  url: string;
}) {
  const dateText = data.checkin
    ? `${data.checkin}${data.checkout ? ` → ${data.checkout}` : ""}${
        data.room ? ` · ห้อง ${data.room}` : ""
      }`
    : "";
  const terms = (data.terms || []).slice(0, 5);

  const body: Record<string, unknown>[] = [
    {
      type: "text",
      text: data.title,
      weight: "bold",
      size: "lg",
      color: "#5C4033",
      wrap: true,
    },
    {
      type: "text",
      text: `${data.businessName} · 🐱 ${data.catName}`,
      size: "xs",
      color: "#A2907E",
      margin: "md",
      wrap: true,
    },
  ];
  if (dateText) {
    body.push(flexDetailRow("🗓️", "เข้าพัก", dateText));
  }
  if (terms.length) {
    body.push({ type: "separator", margin: "lg" });
    body.push({
      type: "box",
      layout: "vertical",
      margin: "lg",
      spacing: "sm",
      contents: terms.map((t, i) => ({
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [
          { type: "text", text: `${i + 1}.`, size: "xs", color: "#A2907E", flex: 0 },
          { type: "text", text: t, size: "xs", color: "#4E3E32", wrap: true, flex: 1 },
        ],
      })),
    });
  }
  body.push({
    type: "text",
    text: "กดปุ่มด้านล่างเพื่ออ่านฉบับเต็ม กดยอมรับ และแจ้งการดูแลเพิ่มเติมของน้องได้ค่ะ 🧡",
    size: "xs",
    color: "#A2907E",
    margin: "lg",
    wrap: true,
  });

  return {
    type: "flex",
    altText: `${data.title} — ${data.catName}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: BRAND_GREEN,
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: "📋 เงื่อนไขก่อนเข้าพัก",
            color: "#FFFFFF",
            weight: "bold",
            size: "sm",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: body,
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "12px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: BRAND_GREEN_DARK,
            height: "sm",
            action: {
              type: "uri",
              label: "📋 ข้อตกลงก่อนเข้าพัก",
              uri: data.url,
            },
          },
        ],
      },
    },
  };
}

/** @deprecated ใช้ buildAppointmentConfirmFlex แทน */
export function buildReminderFlex(booking: {
  id: string;
  catName: string;
  customerName: string;
  service: string;
  when: string;
  confirmUrl: string;
}, style?: CardStyleConfig) {
  return buildAppointmentConfirmFlex({
    ...booking,
    date: booking.when,
    mapsUrl: "https://maps.app.goo.gl/u38pzVGa9LiEsLEK8",
    location: "CatCha Hotel · บางนา เมกะ เทพารักษ์",
  }, style);
}

export function buildPromoFlex(data: {
  title: string;
  body: string;
  imageUrl?: string;
  promoUrl: string;
  discountLabel?: string;
  buttons?: { label: string; uri: string }[];
}, style?: CardStyleConfig) {
  const hero = data.imageUrl
    ? {
        type: "image" as const,
        url: data.imageUrl,
        size: "full" as const,
        aspectRatio: "20:13" as const,
        aspectMode: "cover" as const,
      }
    : {
        type: "box" as const,
        layout: "vertical" as const,
        backgroundColor: style?.headerColor || BRAND_GREEN,
        paddingAll: "20px",
        contents: [
          {
            type: "text" as const,
            text: style?.texts?.header || "✨ โปรโมชั่น CatCha",
            color: style?.headerTextColor || "#FFFFFF",
            weight: "bold" as const,
            size: "md" as const,
            wrap: true,
          },
        ],
      };

  return {
    type: "flex",
    altText: data.title,
    contents: {
      type: "bubble",
      size: "mega",
      hero,
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: data.title,
            weight: "bold",
            size: style?.titleSize || "lg",
            color: style?.accentColor || "#5C4033",
            wrap: true,
          },
          ...(data.discountLabel
            ? [
                {
                  type: "text" as const,
                  text: data.discountLabel,
                  size: "sm" as const,
                  color: style?.buttonColor || BRAND_GREEN_DARK,
                  weight: "bold" as const,
                  margin: "md" as const,
                },
              ]
            : []),
          {
            type: "text",
            text: data.body,
            size: "sm",
            color: "#4E3E32",
            margin: "md",
            wrap: true,
          },
          ...(style?.closing
            ? [
                {
                  type: "text" as const,
                  text: style.closing,
                  size: "xs" as const,
                  color: "#A2907E",
                  margin: "lg" as const,
                  wrap: true,
                },
              ]
            : []),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: (data.buttons?.length
          ? data.buttons.slice(0, 3)
          : [{ label: "ดูรายละเอียด", uri: data.promoUrl }]
        ).map((btn, i) => ({
          type: "button" as const,
          style: (i === 0 ? "primary" : "secondary") as "primary" | "secondary",
          color: i === 0 ? style?.buttonColor || BRAND_GREEN_DARK : undefined,
          height: "sm" as const,
          action: {
            type: "uri" as const,
            label: btn.label,
            uri: btn.uri,
          },
        })),
      },
    },
  };
}

export function buildPaymentFlex(data: {
  invoiceId: string;
  customerName: string;
  catName: string;
  total: number;
  items: { label: string; amount: number }[];
  payUrl: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}, style?: CardStyleConfig) {
  const show = (k: string) => style?.show?.[k] !== false;
  const lines = data.items
    .map((i) => `${i.label} ${i.amount.toLocaleString()} บาท`)
    .join("\n");

  return {
    type: "flex",
    altText: `ชำระเงิน ${data.total} บาท — CatCha Hotel`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: style?.texts?.title || "💳 แจ้งชำระเงิน",
            weight: "bold",
            size: style?.titleSize || "lg",
            color: style?.headerColor || "#5C4033",
            wrap: true,
          },
          {
            type: "text",
            text: `${data.catName} · ${data.customerName}`,
            size: "sm",
            color: "#A2907E",
            margin: "md",
            wrap: true,
          },
          ...(show("items")
            ? [
                {
                  type: "text" as const,
                  text: lines,
                  size: "xs" as const,
                  color: "#4E3E32",
                  margin: "md" as const,
                  wrap: true,
                },
              ]
            : []),
          {
            type: "separator",
            margin: "lg",
          },
          {
            type: "text",
            text: `รวม ${data.total.toLocaleString()} บาท`,
            weight: "bold",
            size: "xl",
            color: style?.accentColor || "#C4956A",
            margin: "lg",
          },
          ...(show("bank")
            ? [
                {
                  type: "box" as const,
                  layout: "vertical" as const,
                  margin: "lg" as const,
                  spacing: "xs" as const,
                  paddingAll: "12px",
                  backgroundColor: "#F4ECE0",
                  cornerRadius: "10px",
                  contents: [
                    {
                      type: "text",
                      text: data.bankName,
                      weight: "bold",
                      size: "md",
                      color: "#5C4033",
                    },
                    {
                      type: "text",
                      text: data.accountNumber,
                      weight: "bold",
                      size: "xl",
                      color: "#4A7348",
                      wrap: true,
                    },
                    {
                      type: "text",
                      text: `ชื่อบัญชี: ${data.accountName}`,
                      size: "sm",
                      color: "#A2907E",
                      wrap: true,
                    },
                  ],
                },
              ]
            : []),
          ...(style?.closing
            ? [
                {
                  type: "text" as const,
                  text: style.closing,
                  size: "xs" as const,
                  color: "#A2907E",
                  margin: "lg" as const,
                  wrap: true,
                },
              ]
            : []),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          ...(show("bank")
            ? [
                {
                  type: "button" as const,
                  style: "primary" as const,
                  color: style?.buttonColor || "#4A7348",
                  height: "sm" as const,
                  action: {
                    type: "clipboard" as const,
                    label: "📋 คัดลอกเลขบัญชี",
                    clipboardText: data.accountNumber,
                  },
                },
              ]
            : []),
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "uri",
              label: "ดูรายละเอียด",
              uri: data.payUrl,
            },
          },
        ],
      },
    },
  };
}

/** การ์ดสรุปให้ลูกค้า (สรุปการจอง / แจ้งมัดจำ / แจ้งยอดเต็ม) ส่งจากหน้าคิดเงิน */
export function buildBillSummaryFlex(data: {
  mode: "booking" | "deposit" | "full" | "remaining";
  title: string;
  closing?: string;
  customerName: string;
  catName: string;
  /** วันที่/เวลานัด หรือช่วงเข้าพัก (แสดงใต้ชื่อ) */
  scheduleText?: string;
  items: { label: string; amount: number }[];
  subtotal: number;
  discount?: number;
  total: number;
  deposit?: number;
  remaining?: number;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}, style?: CardStyleConfig) {
  const st = style || {};
  const show = (k: string) => st.show?.[k] !== false;
  const titleColor = st.headerColor || "#5C4033";
  const accent = st.accentColor || "#C4956A";
  const closing = st.closing ?? data.closing;
  const icon =
    data.mode === "deposit"
      ? "💰"
      : data.mode === "full" || data.mode === "remaining"
        ? "💳"
        : "📋";
  const showBank =
    show("bank") &&
    (data.mode === "deposit" ||
      data.mode === "full" ||
      data.mode === "remaining") &&
    !!data.accountNumber;
  const deposit = data.deposit || 0;
  const remaining = data.remaining ?? Math.max(0, data.total - deposit);
  const altAmount = data.mode === "remaining" ? remaining : data.total;

  const money = (n: number) => `${n.toLocaleString()} บาท`;

  // แยกของแถมฟรี (ยอด 0) ออกมาโชว์เป็นกล่อง "ของแถมฟรี" ต่างหาก
  const freebieItems = data.items.filter((i) => i.amount === 0);
  const paidItems = data.items.filter((i) => i.amount !== 0);

  const body: Record<string, unknown>[] = [
    {
      type: "text",
      text: `${icon} ${data.title}`,
      weight: "bold",
      size: st.titleSize || "lg",
      color: titleColor,
      wrap: true,
    },
    {
      type: "text",
      text: `${data.catName} · ${data.customerName}`,
      size: "sm",
      color: "#A2907E",
      margin: "sm",
      wrap: true,
    },
    ...(data.scheduleText && show("schedule")
      ? [
          {
            type: "text",
            text: data.scheduleText,
            size: "sm",
            weight: "bold",
            color: "#5C4033",
            margin: "sm",
            wrap: true,
          },
        ]
      : []),
    { type: "separator", margin: "lg" },
    {
      type: "box",
      layout: "vertical",
      margin: "lg",
      spacing: "xs",
      contents: paidItems.map((i) => ({
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: i.label,
            size: "sm",
            color: "#4E3E32",
            flex: 4,
            wrap: true,
          },
          {
            type: "text",
            text: money(i.amount),
            size: "sm",
            color: "#4E3E32",
            align: "end",
            flex: 3,
          },
        ],
      })),
    },
  ];

  if (data.discount && data.discount > 0) {
    body.push({
      type: "box",
      layout: "horizontal",
      margin: "md",
      contents: [
        { type: "text", text: "ส่วนลด", size: "sm", color: "#C08A2E", flex: 4 },
        {
          type: "text",
          text: `-${money(data.discount)}`,
          size: "sm",
          color: "#C08A2E",
          align: "end",
          flex: 3,
        },
      ],
    });
  }

  body.push({ type: "separator", margin: "lg" });
  body.push({
    type: "box",
    layout: "horizontal",
    margin: "lg",
    contents: [
      {
        type: "text",
        text: "ยอดสุทธิ",
        weight: "bold",
        size: "md",
        color: "#5C4033",
        flex: 3,
      },
      {
        type: "text",
        text: money(data.total),
        weight: "bold",
        size: "lg",
        color: accent,
        align: "end",
        flex: 4,
      },
    ],
  });

  // 🎁 ของแถมฟรี — โชว์ให้ลูกค้าเห็นว่าแถมอะไรบ้าง
  if (freebieItems.length && show("freebies")) {
    body.push({
      type: "box",
      layout: "vertical",
      margin: "lg",
      spacing: "xs",
      paddingAll: "12px",
      backgroundColor: "#FBF7F0",
      cornerRadius: "10px",
      contents: [
        {
          type: "text",
          text: "🎁 ของแถมฟรี",
          weight: "bold",
          size: "xs",
          color: "#5C4033",
        },
        ...freebieItems.map((i) => ({
          type: "text",
          text: `• ${i.label.replace(/^🎁\s*/, "").replace(/\s*\(ฟรี\)\s*$/, "")}`,
          size: "xs",
          color: "#7A6A5A",
          wrap: true,
        })),
      ],
    });
  }

  const showDeposit =
    data.mode === "deposit" ||
    data.mode === "remaining" ||
    (data.mode === "booking" && deposit > 0);
  if (showDeposit) {
    const isRemaining = data.mode === "remaining";
    const isBooking = data.mode === "booking";
    const paidLabel = isRemaining
      ? "มัดจำที่ชำระแล้ว"
      : isBooking
        ? "มัดจำ"
        : "มัดจำที่ต้องโอน";
    const dueLabel = isRemaining
      ? "ยอดที่ต้องโอนตอนนี้"
      : isBooking
        ? "ยอดคงเหลือ"
        : "ยอดคงเหลือ (ก่อนเข้าพัก)";
    body.push({
      type: "box",
      layout: "vertical",
      margin: "md",
      spacing: "xs",
      paddingAll: "10px",
      backgroundColor: "#F4ECE0",
      cornerRadius: "10px",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: paidLabel, size: "sm", color: "#4E3E32", flex: 5 },
            {
              type: "text",
              text: money(deposit),
              size: "sm",
              weight: "bold",
              color: "#4A7348",
              align: "end",
              flex: 4,
            },
          ],
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: dueLabel, size: isRemaining ? "md" : "sm", color: "#4E3E32", flex: 5 },
            {
              type: "text",
              text: money(remaining),
              size: isRemaining ? "lg" : "sm",
              weight: "bold",
              color: "#B4553B",
              align: "end",
              flex: 4,
            },
          ],
        },
      ],
    });
  }

  if (showBank) {
    body.push({
      type: "box",
      layout: "vertical",
      margin: "lg",
      spacing: "xs",
      paddingAll: "12px",
      backgroundColor: "#F4ECE0",
      cornerRadius: "10px",
      contents: [
        {
          type: "text",
          text: data.bankName || "",
          weight: "bold",
          size: "md",
          color: "#5C4033",
        },
        {
          type: "text",
          text: data.accountNumber || "",
          weight: "bold",
          size: "xl",
          color: "#4A7348",
          wrap: true,
        },
        {
          type: "text",
          text: `ชื่อบัญชี: ${data.accountName || ""}`,
          size: "sm",
          color: "#A2907E",
          wrap: true,
        },
      ],
    });
  }

  if (closing && show("closing")) {
    body.push({
      type: "text",
      text: closing,
      size: "xs",
      color: "#A2907E",
      margin: "lg",
      wrap: true,
    });
  }

  const bubble: Record<string, unknown> = {
    type: "bubble",
    size: "mega",
    body: { type: "box", layout: "vertical", contents: body },
  };

  if (showBank) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          color: st.buttonColor || "#4A7348",
          height: "sm",
          action: {
            type: "clipboard",
            label: "📋 คัดลอกเลขบัญชี",
            clipboardText: data.accountNumber || "",
          },
        },
      ],
    };
  }

  return {
    type: "flex",
    altText: `${data.title} — ${money(altAmount)}`,
    contents: bubble,
  };
}

/** การ์ดแจ้งเข้าพัก — จัดรูปแบบสวยงาม อ่านง่าย + ปุ่มไปกดยอมรับเงื่อนไข */
export function buildPrestayFlex(data: {
  businessName: string;
  catName: string;
  /** ช่วงวันเข้าพัก จัดรูปแล้ว เช่น "12 ก.ค. 2569 → 17 ก.ค. 2569" */
  dateText: string;
  room?: string;
  intro: string;
  prepIntro?: string;
  prepItems: string[];
  careNote?: string;
  litterNote?: string;
  consentUrl?: string;
  consentLabel?: string;
}, style?: CardStyleConfig) {
  const show = (k: string) => style?.show?.[k] !== false;
  const body: Record<string, unknown>[] = [
    // ชื่อน้อง + ร้าน
    {
      type: "text",
      text: `🐱 ${data.catName}`,
      weight: "bold",
      size: style?.titleSize || "xl",
      color: style?.accentColor || "#5C4033",
      wrap: true,
    },
    {
      type: "text",
      text: data.businessName,
      size: "xs",
      color: "#A2907E",
      margin: "xs",
    },
    // ทักทายเปิด
    {
      type: "text",
      text: data.intro,
      size: "sm",
      color: "#4E3E32",
      margin: "lg",
      wrap: true,
    },
  ];

  // กล่องไฮไลต์วันเข้าพัก + ห้อง
  const dateBox: Record<string, unknown>[] = [];
  if (data.dateText && show("dates")) {
    dateBox.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "📅", size: "sm", flex: 0 },
        {
          type: "box",
          layout: "vertical",
          flex: 5,
          contents: [
            { type: "text", text: "วันเข้าพัก", size: "xxs", color: "#9B8B7E" },
            {
              type: "text",
              text: data.dateText,
              size: "sm",
              weight: "bold",
              color: "#4A7348",
              wrap: true,
              margin: "xs",
            },
          ],
        },
      ],
    });
  }
  if (data.room && show("room")) {
    dateBox.push({
      type: "box",
      layout: "horizontal",
      margin: dateBox.length ? "md" : "none",
      contents: [
        { type: "text", text: "🏠", size: "sm", flex: 0 },
        {
          type: "box",
          layout: "vertical",
          flex: 5,
          contents: [
            { type: "text", text: "ห้องพัก", size: "xxs", color: "#9B8B7E" },
            {
              type: "text",
              text: data.room,
              size: "sm",
              weight: "bold",
              color: "#4E3E32",
              wrap: true,
              margin: "xs",
            },
          ],
        },
      ],
    });
  }
  if (dateBox.length) {
    body.push({
      type: "box",
      layout: "vertical",
      margin: "lg",
      paddingAll: "14px",
      backgroundColor: "#F4ECE0",
      cornerRadius: "12px",
      spacing: "sm",
      contents: dateBox,
    });
  }

  // หัวข้อ + เกริ่นของที่ต้องเตรียม
  const prep = show("prep") ? data.prepItems.filter(Boolean) : [];
  if (prep.length) {
    body.push({ type: "separator", margin: "xl" });
    body.push({
      type: "text",
      text: style?.texts?.prepTitle || "🧳 สิ่งที่ต้องเตรียมมาด้วย",
      weight: "bold",
      size: "md",
      color: style?.headerColor || "#5C4033",
      margin: "lg",
    });
    if (data.prepIntro) {
      body.push({
        type: "text",
        text: data.prepIntro,
        size: "xs",
        color: "#A2907E",
        margin: "sm",
        wrap: true,
      });
    }
    body.push({
      type: "box",
      layout: "vertical",
      margin: "md",
      paddingAll: "12px",
      backgroundColor: "#FBF7F0",
      cornerRadius: "10px",
      spacing: "md",
      contents: prep.map((item) => ({
        type: "text",
        text: item,
        size: "sm",
        color: "#4E3E32",
        wrap: true,
      })),
    });
  }

  // แจ้งเตรียมทราย (ถ้าเข้าพักไม่ถึงเกณฑ์แถมฟรี) — โทนส้มเตือน
  if (data.litterNote && show("litter")) {
    body.push({
      type: "box",
      layout: "vertical",
      margin: "md",
      paddingAll: "12px",
      backgroundColor: "#FBEEE0",
      cornerRadius: "10px",
      contents: [
        {
          type: "text",
          text: data.litterNote,
          size: "xs",
          color: "#B4553B",
          wrap: true,
        },
      ],
    });
  }

  // ปิดท้าย — ชวนแจ้งการดูแลพิเศษ (โทนอบอุ่น)
  if (data.careNote && show("care")) {
    body.push({
      type: "box",
      layout: "vertical",
      margin: "lg",
      paddingAll: "12px",
      backgroundColor: "#FBF0F1",
      cornerRadius: "10px",
      contents: [
        {
          type: "text",
          text: data.careNote,
          size: "xs",
          color: "#7A6A5A",
          wrap: true,
        },
      ],
    });
  }

  if (style?.closing) {
    body.push({
      type: "text",
      text: style.closing,
      size: "xs",
      color: "#A2907E",
      margin: "lg",
      wrap: true,
    });
  }

  const bubble: Record<string, unknown> = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: style?.headerColor || BRAND_GREEN,
      paddingAll: "16px",
      contents: [
        {
          type: "text",
          text: style?.texts?.header || "🏠 เตรียมตัวก่อนเข้าพัก",
          color: style?.headerTextColor || "#FFFFFF",
          weight: "bold",
          size: "sm",
          wrap: true,
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      contents: body,
    },
  };

  if (data.consentUrl) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: style?.buttonColor || BRAND_GREEN_DARK,
          height: "sm",
          action: {
            type: "uri",
            label: data.consentLabel || "🧡 อ่านรายละเอียด & ยืนยันการเข้าพัก",
            uri: data.consentUrl,
          },
        },
      ],
    };
  }

  return {
    type: "flex",
    altText: `เตรียมตัวก่อนเข้าพัก 🏠 ${data.catName}`,
    contents: bubble,
  };
}

/** การ์ดให้ลูกค้าเลือกเวลามาส่ง/รับน้อง — ข้อความ + ปุ่มไปหน้าเลือกเวลาใน LIFF */
export function buildTimePickerFlex(data: {
  title: string;
  body: string;
  url?: string;
  label?: string;
}, style?: CardStyleConfig) {
  const bodyContents: Record<string, unknown>[] = [
    {
      type: "text",
      text: data.body,
      size: "sm",
      color: "#4E3E32",
      wrap: true,
    },
  ];
  if (style?.closing) {
    bodyContents.push({
      type: "text",
      text: style.closing,
      size: "xs",
      color: "#A2907E",
      margin: "lg",
      wrap: true,
    });
  }
  const bubble: Record<string, unknown> = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: style?.headerColor || BRAND_GREEN,
      paddingAll: "16px",
      contents: [
        {
          type: "text",
          text: data.title,
          color: style?.headerTextColor || "#FFFFFF",
          weight: "bold",
          size: style?.titleSize || "sm",
          wrap: true,
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      contents: bodyContents,
    },
  };
  if (data.url) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: style?.buttonColor || BRAND_GREEN_DARK,
          height: "sm",
          action: {
            type: "uri",
            label: style?.texts?.button || data.label || "🕒 เลือกเวลา",
            uri: data.url,
          },
        },
      ],
    };
  }
  return {
    type: "flex",
    altText: `${data.title} 🕒`,
    contents: bubble,
  };
}

/** การ์ดสอบถามประวัติน้องก่อนอาบน้ำ — ข้อความ + ปุ่มไปกรอกแบบฟอร์มใน LIFF */
export function buildGroomInfoFlex(data: {
  catName: string;
  dateText?: string;
  body: string;
  url?: string;
  label?: string;
}, style?: CardStyleConfig) {
  const st = style || {};
  const show = (k: string) => st.show?.[k] !== false;
  const contents: Record<string, unknown>[] = [
    {
      type: "text",
      text: `🐱 ${data.catName}`,
      weight: "bold",
      size: st.titleSize || "lg",
      color: st.accentColor || "#5C4033",
      wrap: true,
    },
  ];
  if (data.dateText && show("date")) {
    contents.push({
      type: "text",
      text: data.dateText,
      size: "xs",
      color: "#A2907E",
      margin: "xs",
      wrap: true,
    });
  }
  contents.push({
    type: "text",
    text: data.body,
    size: "sm",
    color: "#4E3E32",
    margin: "md",
    wrap: true,
  });

  if (st.closing) {
    contents.push({ type: "text", text: st.closing, size: "xs", color: "#A2907E", margin: "md", wrap: true });
  }

  const bubble: Record<string, unknown> = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: st.headerColor || BRAND_GREEN,
      paddingAll: "16px",
      contents: [
        {
          type: "text",
          text: "🩺 ประวัติน้องก่อนอาบน้ำ",
          color: st.headerTextColor || "#FFFFFF",
          weight: "bold",
          size: "sm",
        },
      ],
    },
    body: { type: "box", layout: "vertical", paddingAll: "16px", contents },
  };
  if (data.url) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: st.buttonColor || BRAND_GREEN_DARK,
          height: "sm",
          action: {
            type: "uri",
            label: data.label || "🩺 แจ้งประวัติน้อง",
            uri: data.url,
          },
        },
      ],
    };
  }
  return {
    type: "flex",
    altText: `ประวัติน้องก่อนอาบน้ำ 🩺 ${data.catName}`,
    contents: bubble,
  };
}

/** การ์ดเรียกเก็บมัดจำ — ชัดๆ ว่าต้องโอนเท่าไหร่ (ส่งก่อนลูกค้าโอน) */
export function buildDepositRequestFlex(data: {
  title: string;
  body: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  note?: string;
  percentNote?: string;
}, style?: CardStyleConfig) {
  const st = style || {};
  const show = (k: string) => st.show?.[k] !== false;
  const body: Record<string, unknown>[] = [
    { type: "text", text: data.title, weight: "bold", size: st.titleSize || "lg", color: st.headerColor || "#5C4033", wrap: true },
    { type: "text", text: data.body, size: "sm", color: "#4E3E32", margin: "md", wrap: true },
  ];
  if (data.note && show("note")) {
    body.push({ type: "text", text: data.note, size: "xs", color: "#A2907E", margin: "sm", wrap: true });
  }
  body.push({
    type: "box",
    layout: "vertical",
    margin: "lg",
    paddingAll: "14px",
    backgroundColor: "#FBF4E9",
    cornerRadius: "12px",
    spacing: "xs",
    contents: [
      { type: "text", text: "มัดจำที่ต้องโอน", size: "sm", color: "#A2907E", align: "center" },
      {
        type: "text",
        text: `${data.amount.toLocaleString()} บาท`,
        weight: "bold",
        size: "3xl",
        color: st.accentColor || "#C4956A",
        align: "center",
      },
      ...(data.percentNote
        ? [
            {
              type: "text",
              text: `(${data.percentNote})`,
              size: "xs",
              color: "#A2907E",
              align: "center",
            },
          ]
        : []),
    ],
  });
  if (show("bank")) {
    body.push({
      type: "box",
      layout: "vertical",
      margin: "lg",
      spacing: "xs",
      paddingAll: "12px",
      backgroundColor: "#F4ECE0",
      cornerRadius: "10px",
      contents: [
        { type: "text", text: data.bankName, weight: "bold", size: "md", color: "#5C4033" },
        { type: "text", text: data.accountNumber, weight: "bold", size: "xl", color: "#4A7348", wrap: true },
        { type: "text", text: `ชื่อบัญชี: ${data.accountName}`, size: "sm", color: "#A2907E", wrap: true },
      ],
    });
  }
  if (st.closing) {
    body.push({ type: "text", text: st.closing, size: "xs", color: "#A2907E", margin: "lg", wrap: true });
  }

  return {
    type: "flex",
    altText: `ขอรับมัดจำ ${data.amount.toLocaleString()} บาท`,
    contents: {
      type: "bubble",
      size: "mega",
      body: { type: "box", layout: "vertical", contents: body },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: st.buttonColor || "#4A7348",
            height: "sm",
            action: {
              type: "clipboard",
              label: "📋 คัดลอกเลขบัญชี",
              clipboardText: data.accountNumber,
            },
          },
        ],
      },
    },
  };
}

/** การ์ดขอบคุณ + เงื่อนไข ตอนรับมัดจำล่วงหน้า (ข้อความแก้ได้ในตั้งค่า > ข้อความ) */
export function buildDepositThanksFlex(data: {
  title: string;
  body: string;
  terms: string[];
  amount: number;
  note?: string;
  percentNote?: string;
}, style?: CardStyleConfig) {
  const show = (k: string) => style?.show?.[k] !== false;
  const boxContents: Record<string, unknown>[] = [
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: style?.texts?.amountLabel || "มัดจำที่รับ", size: "sm", color: "#4E3E32", flex: 3 },
        {
          type: "text",
          text: `${data.amount.toLocaleString()} บาท`,
          size: "md",
          weight: "bold",
          color: style?.accentColor || "#4A7348",
          align: "end",
          flex: 4,
        },
      ],
    },
  ];
  if (data.percentNote && show("percent")) {
    boxContents.push({
      type: "text",
      text: data.percentNote,
      size: "xs",
      color: "#A2907E",
      margin: "xs",
      align: "end",
    });
  }
  if (data.note && show("note")) {
    boxContents.push({
      type: "text",
      text: data.note,
      size: "xs",
      color: "#A2907E",
      margin: "sm",
      wrap: true,
    });
  }

  const contents: Record<string, unknown>[] = [
    {
      type: "text",
      text: data.title,
      weight: "bold",
      size: style?.titleSize || "lg",
      color: style?.headerColor || "#5C4033",
      wrap: true,
    },
    { type: "text", text: data.body, size: "sm", color: "#4E3E32", margin: "md", wrap: true },
    {
      type: "box",
      layout: "vertical",
      margin: "lg",
      paddingAll: "12px",
      backgroundColor: "#F4ECE0",
      cornerRadius: "10px",
      contents: boxContents,
    },
  ];

  if (data.terms.length > 0 && show("terms")) {
    contents.push({ type: "separator", margin: "lg" });
    contents.push({
      type: "text",
      text: style?.texts?.termsTitle || "🐾 เงื่อนไขมัดจำ",
      weight: "bold",
      size: "xs",
      color: style?.headerColor || "#5C4033",
      margin: "lg",
    });
    contents.push({
      type: "box",
      layout: "vertical",
      margin: "sm",
      spacing: "sm",
      contents: data.terms.map((t) => ({
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [
          { type: "text", text: "•", size: "xs", color: "#C4956A", flex: 0 },
          { type: "text", text: t, size: "xs", color: "#7A6A5A", wrap: true, flex: 1 },
        ],
      })),
    });
  }

  if (style?.closing) {
    contents.push({
      type: "text",
      text: style.closing,
      size: "xs",
      color: "#A2907E",
      margin: "lg",
      wrap: true,
    });
  }

  return {
    type: "flex",
    altText: `${data.title} — ${data.amount.toLocaleString()} บาท`,
    contents: {
      type: "bubble",
      size: "mega",
      body: { type: "box", layout: "vertical", contents },
    },
  };
}

export function buildReceiptFlex(data: {
  invoiceId: string;
  customerName: string;
  catName: string;
  total: number;
  pointsEarned: number;
  paymentMethod: string;
}, style?: CardStyleConfig) {
  const st = style || {};
  const show = (k: string) => st.show?.[k] !== false;
  const bubble: Record<string, unknown> = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: st.headerColor || "#C4956A",
      paddingAll: "18px",
      contents: [
        { type: "text", text: "🧾 ใบเสร็จรับเงิน", color: st.headerTextColor || "#FFFFFF", weight: "bold", size: st.titleSize || "lg" },
        { type: "text", text: "CatCha Hotel", color: st.headerTextColor || "#FFFFFF", size: "xs", margin: "xs" },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "18px",
      contents: [
        flexDetailRow("🐱", "ลูกค้า", `${data.catName} · ${data.customerName}`),
        ...(show("invoiceNo") ? [flexDetailRow("🔖", "เลขที่", data.invoiceId)] : []),
        { type: "separator", margin: "lg", color: "#EFE3D2" },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          paddingAll: "16px",
          backgroundColor: "#FBF4E9",
          cornerRadius: "12px",
          spacing: "xs",
          contents: [
            { type: "text", text: "ชำระแล้ว", size: "sm", color: "#A2907E", align: "center" },
            {
              type: "text",
              text: `${data.total.toLocaleString()} บาท`,
              weight: "bold",
              size: "3xl",
              color: st.accentColor || "#4A7348",
              align: "center",
            },
            {
              type: "text",
              text: `(${data.paymentMethod})`,
              size: "xs",
              color: "#A2907E",
              align: "center",
            },
          ],
        },
        ...(show("points")
          ? [
              {
                type: "box",
                layout: "horizontal",
                margin: "lg",
                paddingAll: "12px",
                backgroundColor: "#F4ECE0",
                cornerRadius: "10px",
                contents: [
                  { type: "text", text: "🎁 แต้มสะสมที่ได้รับ", size: "sm", color: "#5C4033", flex: 3 },
                  {
                    type: "text",
                    text: `+${data.pointsEarned}`,
                    weight: "bold",
                    size: "md",
                    color: "#C4956A",
                    align: "end",
                    flex: 2,
                  },
                ],
              },
            ]
          : []),
        ...(show("closing")
          ? [
              {
                type: "text",
                text: st.closing || "ขอบคุณที่ไว้วางใจ CatCha Hotel นะคะ 🧡",
                size: "xs",
                color: "#A2907E",
                margin: "lg",
                align: "center",
                wrap: true,
              },
            ]
          : []),
      ],
    },
  };

  return {
    type: "flex",
    altText: `ใบเสร็จ ${data.total} บาท — CatCha Hotel`,
    contents: bubble,
  };
}

/** การ์ดคูปองโปร — ลูกค้ากดรับเก็บเข้ากระเป๋าคูปอง */
export function buildCouponOfferFlex(data: {
  title: string;
  amount: number;
  body?: string;
  url: string;
  validDays?: number;
}, style?: CardStyleConfig) {
  return {
    type: "flex",
    altText: `🎟️ คูปองส่วนลด ${data.amount} บาท — ${data.title}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: style?.headerColor || BRAND_GREEN,
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: style?.texts?.header || "🎟️ คูปองส่วนลดพิเศษ",
            color: style?.headerTextColor || "#FFFFFF",
            weight: "bold",
            size: "sm",
            wrap: true,
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: data.title,
            weight: "bold",
            size: style?.titleSize || "lg",
            color: style?.accentColor || "#5C4033",
            wrap: true,
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            paddingAll: "14px",
            backgroundColor: "#FBF4E9",
            cornerRadius: "12px",
            contents: [
              { type: "text", text: "ส่วนลด", size: "sm", color: "#A2907E", align: "center" },
              {
                type: "text",
                text: `${data.amount.toLocaleString()} บาท`,
                weight: "bold",
                size: "3xl",
                color: style?.accentColor || "#C4956A",
                align: "center",
              },
            ],
          },
          ...(data.body
            ? [
                {
                  type: "text" as const,
                  text: data.body,
                  size: "sm" as const,
                  color: "#4E3E32",
                  margin: "lg" as const,
                  wrap: true,
                },
              ]
            : []),
          {
            type: "text",
            text: `${style?.closing || "กดรับแล้วเก็บไว้ในกระเป๋าคูปอง ใช้เป็นส่วนลดได้เลย"}${
              data.validDays ? ` (ใช้ได้ ${data.validDays} วัน)` : ""
            } 🧡`,
            size: "xs",
            color: "#A2907E",
            margin: "lg",
            wrap: true,
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "12px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: style?.buttonColor || BRAND_GREEN_DARK,
            height: "sm",
            action: {
              type: "uri",
              label: style?.texts?.button || "🎟️ กดรับคูปอง",
              uri: data.url,
            },
          },
        ],
      },
    },
  };
}

/** เลือกข้อความขอรีวิวให้ตรงกับบริการที่ใช้จริงในบิล — อาบน้ำ / เข้าพัก / ทั้งคู่ */
export function reviewMessageFor(hasGroom: boolean, hasRoom: boolean): {
  title: string;
  body: string;
} {
  if (hasRoom && hasGroom) {
    return {
      title: "🧡 ขอบคุณที่เลือก CatCha Hotel ดูแลน้องนะคะ",
      body: "หวังว่าน้องจะกลับบ้านไปพร้อมความสุข และคุณพ่อคุณแม่จะอุ่นใจทุกครั้งที่ใช้บริการกับเรานะคะ 🐾\nถ้าประทับใจในการดูแลของเรา ฝากรีวิวให้ทีมงานสักนิดนะคะ\nทุกรีวิวมีความหมายกับพวกเรามาก และเป็นกำลังใจให้ตั้งใจดูแลน้อง ๆ ทุกตัวต่อไปค่ะ 🤍",
    };
  }
  if (hasRoom) {
    return {
      title: "ขอบคุณที่ไว้วางใจ CatCha Hotel นะคะ 🧡",
      body: "ตลอดช่วงที่น้องเข้าพัก พวกเราตั้งใจดูแลเหมือนเป็นหนึ่งในครอบครัว\nหวังว่าน้องจะกลับบ้านไปอย่างมีความสุขนะคะ 🐱✨\nหากประทับใจการเข้าพักของน้อง ฝากรีวิวให้ CatCha Hotel สัก 1 รีวิวนะคะ\nทุกรีวิวมีความหมายกับพวกเรามาก และเป็นกำลังใจให้ตั้งใจดูแลน้อง ๆ ทุกตัวต่อไปค่ะ",
    };
  }
  // อาบน้ำล้วน (ค่าเริ่มต้นถ้าตรวจไม่พบรายการห้องพัก)
  return {
    title: "ขอบคุณที่ไว้วางใจ CatCha Hotel นะคะ 🧡",
    body: "หวังว่าน้องจะกลับบ้านไปตัวหอม นุ่มฟู และมีความสุขนะคะ 🐱✨\nถ้าประทับใจบริการของเรา ฝากรีวิวสั้น ๆ ให้ทีมงานหน่อยนะคะ\nรีวิวของคุณคือกำลังใจเล็ก ๆ\nที่ทำให้พวกเราตั้งใจดูแลน้องแมวทุกตัวให้ดีที่สุดเลยค่ะ 💕",
  };
}

/** การ์ดขอรีวิว — ส่งหลังลูกค้าใช้บริการจริง (เช่น วันถัดจากเช็คเอาท์) */
export function buildReviewRequestFlex(data: {
  title: string;
  body: string;
  reviewUrl: string;
  reviewLabel?: string;
}, style?: CardStyleConfig) {
  const st = style || {};
  const show = (k: string) => st.show?.[k] !== false;
  // แยกข้อความเป็นบรรทัดตาม \n ที่คนพิมพ์ตั้งใจขึ้นบรรทัดใหม่ไว้อยู่แล้ว
  // แต่ละบรรทัดสั้นพอที่จะไม่ล้นแล้ววกกลับมาตัดคำ/อิโมจิแปลกๆ กลางประโยค
  const paragraphs = data.body
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (st.closing) paragraphs.push(st.closing);

  return {
    type: "flex",
    altText: data.title,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: st.headerColor || "#FBF4E9",
        paddingAll: "20px",
        spacing: "xs",
        contents: [
          ...(show("stars")
            ? [
                {
                  type: "text",
                  text: "⭐ ⭐ ⭐ ⭐ ⭐",
                  size: "md",
                  align: "center",
                  color: st.accentColor || "#C4956A",
                },
              ]
            : []),
          {
            type: "text",
            text: data.title,
            weight: "bold",
            size: st.titleSize || "md",
            color: st.headerTextColor || "#5C4033",
            align: "center",
            margin: "sm",
            wrap: true,
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        spacing: "md",
        contents: paragraphs.map((p) => ({
          type: "text",
          text: p,
          size: "sm",
          color: "#4E3E32",
          wrap: true,
        })),
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "12px",
        spacing: "sm",
        contents: [
          { type: "separator", color: "#F0E4D4" },
          {
            type: "button",
            style: "primary",
            color: st.buttonColor || "#C4956A",
            height: "md",
            margin: "sm",
            action: {
              type: "uri",
              label: data.reviewLabel || "⭐ รีวิวให้เราหน่อยนะคะ",
              uri: data.reviewUrl,
            },
          },
        ],
      },
    },
  };
}

export function buildMemberBalanceFlex(data: {
  customerName: string;
  memberCredit: number;
  usedToday?: number;
  catName?: string;
}, style?: CardStyleConfig) {
  const show = (k: string) => style?.show?.[k] !== false;
  const contents: Record<string, unknown>[] = [
    {
      type: "text",
      text: style?.texts?.title || "💎 สรุปยอด Member",
      weight: "bold",
      size: style?.titleSize || "lg",
      color: style?.headerColor || "#5C4033",
      wrap: true,
    },
  ];
  if (show("customerName")) {
    contents.push({
      type: "text",
      text: data.customerName,
      size: "sm",
      color: "#A2907E",
      margin: "md",
      wrap: true,
    });
  }
  contents.push({
    type: "text",
    text: `${style?.texts?.balanceLabel || "คงเหลือ"} ${data.memberCredit.toLocaleString()} บาท`,
    weight: "bold",
    size: "xl",
    color: style?.accentColor || "#C4956A",
    margin: "lg",
    wrap: true,
  });
  if (show("usedToday") && data.usedToday) {
    contents.push({
      type: "text",
      text: `ใช้วันนี้ ${data.usedToday.toLocaleString()} บาท${data.catName ? ` · ${data.catName}` : ""}`,
      size: "xs",
      color: "#4E3E32",
      margin: "md",
      wrap: true,
    });
  }
  if (style?.closing) {
    contents.push({
      type: "text",
      text: style.closing,
      size: "xs",
      color: "#A2907E",
      margin: "lg",
      wrap: true,
    });
  }

  return {
    type: "flex",
    altText: `ยอด Member ${data.memberCredit} บาท`,
    contents: {
      type: "bubble",
      body: { type: "box", layout: "vertical", contents },
    },
  };
}
