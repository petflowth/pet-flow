# Supabase Setup — CatCha Hotel

## 1. สร้างโปรเจกต์

1. ไปที่ [supabase.com](https://supabase.com) → New project
2. เก็บ **Project URL** และ **service_role key** (Settings → API)

## 2. รัน Schema

1. Supabase Dashboard → **SQL Editor** → New query
2. Copy ทั้งไฟล์ `supabase/schema.sql` วางแล้วกด **Run**
3. ตรวจ Table Editor ว่ามีตาราง: customers, cats, bookings, points_accounts, promos, invoices, ฯลฯ

## 3. ตั้งค่า Vercel

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # อย่าเปิดเผย — ใช้เฉพาะ server
```

Redeploy หลังเพิ่ม env

## 4. ทดสอบ

- จองใหม่ใน Admin → ดูใน Supabase Table `bookings`
- คิดเงิน → ดู `invoices`
- รีสตาร์ท Vercel แล้วข้อมูลยังอยู่ = สำเร็จ

## หมายเหตุ

- ถ้ายังไม่ตั้ง Supabase แอปจะใช้ **in-memory** เหมือนเดิม (ข้อมูลหายเมื่อ cold start)
- `service_role` ข้าม RLS — ใช้เฉพาะใน API routes ฝั่ง server
