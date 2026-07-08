# ติดตั้งแบบง่าย (ไม่ต้องไล่ใส่ Vercel ทีละตัว)

## สิ่งที่ต้องทำเองแค่ 2 อย่าง

### 1. Supabase (ครั้งเดียว)
ใส่ใน Vercel แค่ 3 ตัว:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

แล้วไป **Admin → ติดตั้ง** → กดสร้างตาราง

### 2. Google Calendar + Sheets (ครั้งเดียว)
**ไม่ต้องใส่ Vercel** — ทำในหน้าเว็บเลย:

1. เปิด **Admin → 🚀 ติดตั้ง**
2. วาง **JSON key** จาก Google Cloud (ทั้งไฟล์)
3. วาง **ลิงก์ Google Sheet**
4. วาง **ลิงก์ Google Calendar**
5. Share Sheet + Calendar ให้ `client_email` ใน JSON
6. กด **💾 บันทึก Google**

เสร็จ — จองใหม่จะขึ้นปฏิทิน, กดส่งออก Sheets ได้เลย

---

## Telegram Bot (แจ้งเตือนเจ้าของ)
**ไม่ต้องใส่ Vercel** — ทำในหน้าเว็บ:

1. เปิด **Admin → 🚀 ติดตั้ง**
2. ส่วน **📱 Telegram Bot**
3. Copy **API Token** จาก @BotFather → วาง
4. ใส่ **Chat ID** (ทักบอท /start จะเห็นเลข)
5. กด **💾 บันทึกและเปิดใช้บอท**

เสร็จ — ทักบอทจะเห็นปุ่มเมนู 📅 นัดวันนี้ ฯลฯ

> ถ้าเคยใส่ Token ผิดใน Vercel → ลบ `TELEGRAM_BOT_TOKEN` ใน Vercel แล้วตั้งในหน้านี้แทน

---
ข้ามไปก่อนได้ ระบบอื่นใช้งานได้ปกติ

---

## รันบนเครื่องตัวเอง (Docker)
```bash
cd webapp
cp .env.example .env.local
# ใส่ Supabase ใน .env.local
docker compose up --build
```
เปิด http://localhost:3000/admin/setup
