export function getPaymentConfig() {
  return {
    bankName: process.env.BANK_NAME || "กรุงไทย",
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || "XXX-X-XXXXX-X",
    accountName: process.env.BANK_ACCOUNT_NAME || "บจก. CatCha Hotel",
  };
}
