import { getLineCredentials } from "./line-config";

export type VerifiedLiffIdentity = { lineUserId: string; displayName: string };

/**
 * ตรวจ LIFF ID token กับ LINE ตรงๆ ก่อนเชื่อว่าเป็นลูกค้าคนนั้นจริง
 *
 * เดิมทุก route ฝั่งลูกค้าเชื่อ lineUserId ที่ client ส่งมาใน body/query ตรงๆ —
 * ใครก็ใส่ lineUserId ของคนอื่นแล้วสวมรอยอ่าน/แก้ข้อมูล จองคิว แลกแต้มแทนได้ทันที
 * ID token คือ JWT ที่ LINE เซ็นให้ตอนล็อกอิน LIFF สำเร็จ ปลอมไม่ได้ (ต่างจาก userId ที่เป็นแค่ string ธรรมดา)
 */
export async function verifyLiffIdToken(
  idToken: string
): Promise<VerifiedLiffIdentity | null> {
  if (!idToken || typeof idToken !== "string") return null;

  const creds = await getLineCredentials();
  const liffId = creds?.liffId;
  const clientId = liffId?.split("-")[0];
  if (!clientId) return null;

  try {
    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { sub?: string; name?: string; aud?: string };
    if (!data.sub) return null;
    // aud ต้องตรงกับ channel id ของ LIFF เราเท่านั้น — กัน token จาก LIFF app อื่นเอามาใช้ปลอมตัว
    if (data.aud && data.aud !== clientId) return null;
    return { lineUserId: data.sub, displayName: data.name || "" };
  } catch {
    return null;
  }
}
