import { getSiteConfig } from "./config-store";

export async function getPaymentConfig() {
  const config = await getSiteConfig();
  return config.payment;
}

export function getPaymentConfigSync() {
  return {
    bankName: process.env.BANK_NAME || "กรุงไทย",
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || "XXX-X-XXXXX-X",
    accountName: process.env.BANK_ACCOUNT_NAME || "CatCha Hotel",
  };
}
