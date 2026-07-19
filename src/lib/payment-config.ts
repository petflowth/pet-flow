import { getSiteConfig } from "./config-store";

export async function getPaymentConfig() {
  const config = await getSiteConfig();
  return config.payment;
}

export function getPaymentConfigSync() {
  return {
    bankName: process.env.BANK_NAME || "กรุงไทย",
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || "XXX-X-XXXXX-X",
    // ห้าม default เป็นชื่อร้านใดร้านหนึ่ง — ร้านที่ยังไม่ตั้งค่าจะโชว์ชื่อบัญชีคนอื่นบนการ์ดโอนเงิน
    accountName: process.env.BANK_ACCOUNT_NAME || "",
  };
}
