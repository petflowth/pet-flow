/**
 * LINE Messaging API — ส่งการ์ดเตือนลูกค้า
 * ตั้งค่า: LINE_CHANNEL_TOKEN
 */

import { formatBookingWhen, formatThaiDate } from "./format-thai-date";
import { getLineCredentials } from "./line-config";

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
}) {
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
    "หมายเหตุ แพ้อาหาร/ต้องการอาหารพิเศษ หรือมีความต้องการอื่น แจ้งในแชท LINE ได้เลยค่ะ";

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
        backgroundColor: BRAND_GREEN,
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: "📅 กำหนดการนัด",
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
        contents: [
          {
            type: "text",
            text: serviceTitle,
            weight: "bold",
            size: "lg",
            color: "#5C4033",
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
          flexDetailRow("📍", "สถานที่", booking.location),
          flexDetailRow("📝", "หมายเหตุ", noteText),
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
            color: BRAND_GREEN_DARK,
            height: "sm",
            action: {
              type: "uri",
              label: "🐾 ยืนยันนัด",
              uri: booking.confirmUrl,
            },
          },
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
}) {
  return buildAppointmentConfirmFlex({
    ...booking,
    date: booking.when,
    mapsUrl: "https://maps.app.goo.gl/u38pzVGa9LiEsLEK8",
    location: "CatCha Hotel · บางนา เมกะ เทพารักษ์",
  });
}

export function buildPromoFlex(data: {
  title: string;
  body: string;
  imageUrl?: string;
  promoUrl: string;
  discountLabel?: string;
  buttons?: { label: string; uri: string }[];
}) {
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
        backgroundColor: BRAND_GREEN,
        paddingAll: "20px",
        contents: [
          {
            type: "text" as const,
            text: "✨ โปรโมชั่น CatCha",
            color: "#FFFFFF",
            weight: "bold" as const,
            size: "md" as const,
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
            size: "lg",
            color: "#5C4033",
            wrap: true,
          },
          ...(data.discountLabel
            ? [
                {
                  type: "text" as const,
                  text: data.discountLabel,
                  size: "sm" as const,
                  color: BRAND_GREEN_DARK,
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
          color: i === 0 ? BRAND_GREEN_DARK : undefined,
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
}) {
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
            text: "💳 แจ้งชำระเงิน",
            weight: "bold",
            size: "lg",
            color: "#5C4033",
          },
          {
            type: "text",
            text: `${data.catName} · ${data.customerName}`,
            size: "sm",
            color: "#A2907E",
            margin: "md",
            wrap: true,
          },
          {
            type: "text",
            text: lines,
            size: "xs",
            color: "#4E3E32",
            margin: "md",
            wrap: true,
          },
          {
            type: "separator",
            margin: "lg",
          },
          {
            type: "text",
            text: `รวม ${data.total.toLocaleString()} บาท`,
            weight: "bold",
            size: "xl",
            color: "#C4956A",
            margin: "lg",
          },
          {
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
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#4A7348",
            height: "sm",
            action: {
              type: "clipboard",
              label: "📋 คัดลอกเลขบัญชี",
              clipboardText: data.accountNumber,
            },
          },
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

export function buildReceiptFlex(data: {
  invoiceId: string;
  customerName: string;
  catName: string;
  total: number;
  pointsEarned: number;
  paymentMethod: string;
  mapsUrl: string;
}) {
  return {
    type: "flex",
    altText: `ใบเสร็จ ${data.total} บาท — CatCha Hotel`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "🧾 ใบเสร็จ CatCha Hotel",
            weight: "bold",
            size: "lg",
            color: "#5C4033",
          },
          {
            type: "text",
            text: `${data.catName} · ${data.customerName}`,
            size: "sm",
            color: "#A2907E",
            margin: "md",
          },
          {
            type: "text",
            text: `เลขที่ ${data.invoiceId}`,
            size: "xs",
            color: "#A2907E",
            margin: "sm",
          },
          {
            type: "text",
            text: `ชำระแล้ว ${data.total.toLocaleString()} บาท (${data.paymentMethod})`,
            weight: "bold",
            size: "md",
            color: "#4E3E32",
            margin: "lg",
          },
          {
            type: "text",
            text: `🎁 ได้รับ ${data.pointsEarned} แต้มสะสม`,
            size: "sm",
            color: "#C4956A",
            margin: "md",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "link",
            height: "sm",
            action: {
              type: "uri",
              label: "⭐ รีวิวให้เราหน่อยนะคะ",
              uri: data.mapsUrl,
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
}) {
  return {
    type: "flex",
    altText: `ยอด Member ${data.memberCredit} บาท`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "💎 สรุปยอด Member",
            weight: "bold",
            size: "lg",
            color: "#5C4033",
          },
          {
            type: "text",
            text: data.customerName,
            size: "sm",
            color: "#A2907E",
            margin: "md",
          },
          {
            type: "text",
            text: `คงเหลือ ${data.memberCredit.toLocaleString()} บาท`,
            weight: "bold",
            size: "xl",
            color: "#C4956A",
            margin: "lg",
          },
          ...(data.usedToday
            ? [
                {
                  type: "text" as const,
                  text: `ใช้วันนี้ ${data.usedToday.toLocaleString()} บาท${data.catName ? ` · ${data.catName}` : ""}`,
                  size: "xs" as const,
                  color: "#4E3E32",
                  margin: "md" as const,
                },
              ]
            : []),
        ],
      },
    },
  };
}
