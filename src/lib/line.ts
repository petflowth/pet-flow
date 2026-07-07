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
