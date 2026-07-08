# Supabase Setup — CatCha Hotel

## วิธีง่ายสุด (แนะนำ)

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com) (ฟรี)
2. ใส่ 3 ค่าใน **Vercel → Settings → Environment Variables**:

| ตัวแปร | หาได้ที่ไหน (Supabase Dashboard) |
|--------|----------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role (secret) |
| `DATABASE_URL` | Settings → Database → Connection string → **URI** |

3. **Redeploy** บน Vercel
4. เข้า **Admin → 🚀 ติดตั้ง** (`/admin/setup`)
5. กด **⚡ สร้างตารางอัตโนมัติ** — เสร็จ!

หลังจากนั้นไป **Admin → ⚙️ ตั้งค่า** แก้รูป ราคา โปรได้เลย

---

## วิธีที่ 2 — Copy SQL เอง

ถ้าไม่ใส่ `DATABASE_URL`:

1. Admin → ติดตั้ง → กด **📋 Copy SQL**
2. Supabase → SQL Editor → วาง → Run

หรือเปิดไฟล์ `webapp/supabase/schema.sql` บน GitHub

---

## ทำไม Agent ทำให้ทั้งหมดไม่ได้?

- **Supabase / Vercel** ต้องใช้บัญชีของเจ้าของ (login + password)
- Agent ไม่มีสิทธิ์เข้าบัญชี Stopstop.w โดยตรง
- หลังใส่ env 3 ตัวแล้ว → กดปุ่มเดียวใน Admin สร้างตารางให้เอง

---

## ทดสอบ

- Admin → ติดตั้ง → ต้องขึ้น ✅ พร้อมใช้งาน
- จองใหม่ → ดูตาราง `bookings` ใน Supabase Table Editor
