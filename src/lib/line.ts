/**
 * LINE Messaging API — ส่งการ์ดเตือนลูกค้า
 * ตั้งค่า: LINE_CHANNEL_TOKEN
 */

export async function pushLineMessage(
  to: string,
  messages: object[]
) {
  const token = process.env.LINE_CHANNEL_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_TOKEN not configured");

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to, messages }),
  });

  if (!res.ok) {
    throw new Error(`LINE API: ${await res.text()}`);
  }
  return { ok: true };
}

export function buildReminderFlex(booking: {
  id: string;
  catName: string;
  customerName: string;
  service: string;
  when: string;
  confirmUrl: string;
}) {
  const isRoom = booking.service === "room";
  const hero = isRoom
    ? "พรุ่งนี้ถึงวันเช็คอินแล้วค่ะ"
    : "พรุ่งนี้ถึงคิวอาบน้ำแล้วค่ะ";

  return {
    type: "flex",
    altText: hero,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: hero,
            weight: "bold",
            size: "md",
            color: "#5C4033",
          },
          {
            type: "text",
            text: `${booking.catName} · ${booking.customerName}`,
            size: "sm",
            color: "#A2907E",
            margin: "md",
            wrap: true,
          },
          {
            type: "text",
            text: booking.when,
            size: "sm",
            color: "#4E3E32",
            margin: "sm",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#C4956A",
            height: "sm",
            action: {
              type: "uri",
              label: "🐾 ยืนยันคิว",
              uri: booking.confirmUrl,
            },
          },
        ],
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
            type: "text",
            text: `${data.bankName}\n${data.accountNumber}\n${data.accountName}`,
            size: "xs",
            color: "#4E3E32",
            margin: "md",
            wrap: true,
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#C4956A",
            height: "sm",
            action: {
              type: "uri",
              label: "โอนเงิน / ดูรายละเอียด",
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
