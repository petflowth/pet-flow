/** สร้าง URL เปิดใน LINE LIFF */
export function buildLiffUrl(
  liffId: string,
  params: Record<string, string>
) {
  const q = new URLSearchParams(params);
  return `https://liff.line.me/${liffId}?${q.toString()}`;
}

export function buildCustomerLinkUrl(liffId: string, customerId: string) {
  return buildLiffUrl(liffId, { path: "link", customerId });
}

export function buildRegisterUrl(liffId: string) {
  return buildLiffUrl(liffId, { path: "register" });
}

export function buildConsentUrl(liffId: string) {
  return buildLiffUrl(liffId, { path: "consent" });
}

/** ลิงก์หน้าเลือกเวลาส่ง/รับน้อง (เช็คอิน/เช็คเอาท์) */
export function buildBookingTimeUrl(
  liffId: string,
  bookingId: string,
  type: "checkin" | "checkout"
) {
  return buildLiffUrl(liffId, { path: "booking-time", id: bookingId, type });
}

/** ลิงก์หน้ากรอกประวัติน้องก่อนอาบน้ำ — จองทั้งบ้านหลายตัวใส่เป็น array ได้ ฟอร์มจะรวมทุกตัวในหน้าเดียว */
export function buildGroomInfoUrl(liffId: string, bookingIds: string | string[]) {
  const id = Array.isArray(bookingIds) ? bookingIds.join(",") : bookingIds;
  return buildLiffUrl(liffId, { path: "groom-info", id });
}

/** ลิงก์หน้ากดรับคูปองจากแคมเปญ */
export function buildClaimCouponUrl(liffId: string, offerId: string) {
  return buildLiffUrl(liffId, { path: "claim-coupon", offer: offerId });
}
