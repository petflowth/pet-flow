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
