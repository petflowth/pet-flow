# 🚀 Deploy CatCha Hotel (เจ้าของทำครั้งเดียว ~10 นาที)

## ทำไม Agent deploy ให้ตรงๆ ไม่ได้?
Deploy ต้องใช้ **บัญชี Vercel ของคุณ** (login OAuth) — Agent ไม่มีสิทธิ์เข้าบัญชี Stopstop.w โดยตรง  
คราวที่แล้วที่เห็น “deploy ได้” คือ **Google Apps Script** ที่รันบน Google ของคุณเอง ไม่ใช่ Vercel

### ถ้าอยากให้ Agent deploy ให้ในอนาคต
เพิ่ม **VERCEL_TOKEN** ใน Cursor → Settings → Secrets แล้วบอก Agent อีกครั้ง

---

## วิธีที่ง่ายที่สุด (แนะนำ)

1. เปิด https://vercel.com → Login ด้วย GitHub `stopstopw-bit`
2. **Add New Project** → เลือก repo `Catcha-hotel`
3. ตั้ง **Root Directory** = `webapp`
4. Framework ควรขึ้น **Next.js** (ถ้าขึ้น Other ให้ Redeploy หลัง pull ล่าสุด)
4. ใส่ Environment Variables:

| ชื่อ | ค่า |
|------|-----|
| `NEXT_PUBLIC_LIFF_ID` | จาก LINE Developers |
| `NEXT_PUBLIC_ADMIN_CODE` | รหัสหลังบ้านที่ต้องการ |
| `NEXT_PUBLIC_APP_URL` | URL หลัง deploy เช่น `https://xxx.vercel.app` |
| `LINE_CHANNEL_TOKEN` | LINE Messaging API token |
| `TELEGRAM_BOT_TOKEN` | จาก @BotFather |
| `TELEGRAM_OWNER_CHAT_IDS` | Chat ID ของเจ้าของ (ได้จาก /start ใน bot) |
| `GOOGLE_CALENDAR_ID` | ID ปฏิทิน Catcha Hotel |
| `GOOGLE_SPREADSHEET_ID` | ID Google Sheet สำหรับ export ลูกค้า/การเงิน |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account |
| `GOOGLE_PRIVATE_KEY` | Private key (วางทั้งก้อน) |
| `NEXT_PUBLIC_SUPABASE_URL` | จาก Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (เก็บเป็นความลับ) |
| `BANK_NAME` / `BANK_ACCOUNT_NUMBER` / `BANK_ACCOUNT_NAME` | บัญชีรับโอน |
| `CRON_SECRET` | รหัสสำหรับ Vercel Cron |

5. กด **Deploy** → ได้ URL เช่น `https://catcha-hotel.vercel.app`

---

## ตั้ง Supabase (ฐานข้อมูลถาวร)

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com)
2. SQL Editor → รันไฟล์ `webapp/supabase/schema.sql`
3. ใส่ `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` ใน Vercel
4. Redeploy — ดูรายละเอียดใน `webapp/SUPABASE.md`


## ตั้ง Google Calendar

ดูรายละเอียดใน **`webapp/GOOGLE_CALENDAR.md`**

## ตั้ง Google Sheets Export

ดูรายละเอียดใน **`webapp/GOOGLE_SHEETS.md`**

ใส่ `GOOGLE_SPREADSHEET_ID` + service account เดียวกับ Calendar → กด **ส่งออก Google Sheets** ในหลังบ้าน


## ตั้ง LINE LIFF
1. LINE Developers → LIFF → Endpoint = `https://YOUR-URL.vercel.app/app`
2. Rich Menu @catchahotel → ลิงก์ไป `/app`

## ตั้ง Telegram Bot
1. ทัก @BotFather → `/newbot` → ได้ token
2. ใส่ `TELEGRAM_BOT_TOKEN` ใน Vercel
3. ตั้ง webhook (หลัง deploy):
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR-URL.vercel.app/api/telegram/webhook
   ```
4. ทัก bot → `/start` → copy Chat ID → ใส่ `TELEGRAM_OWNER_CHAT_IDS`

## ดูเว็บบนคอมก่อน deploy
```bash
cd webapp && npm run dev
```
เปิด http://localhost:3000/app
