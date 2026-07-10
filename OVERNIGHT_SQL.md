# SQL ที่ต้องรันครั้งเดียว (ฐานข้อมูลจริงของแอป)

ฟีเจอร์บางอย่างที่ทำคืนนี้ต้องเพิ่มคอลัมน์ในฐานข้อมูล แต่ระบบเข้า DB จริงตรงๆ ไม่ได้
(คนละบัญชี Supabase) โค้ดถูกเขียนให้ **ไม่พังถ้าคอลัมน์ยังไม่มี** — แต่ฟีเจอร์จะทำงานเต็มที่
เมื่อรัน SQL ด้านล่างแล้ว

## วิธีรัน
1. เข้า https://supabase.com/dashboard/project/nqperjfuuntbzskbrqql
2. เมนูซ้าย → **SQL Editor** → **New query**
3. วางทั้งบล็อกด้านล่าง → กด **Run** (ปลอดภัย idempotent รันซ้ำได้ ไม่ลบข้อมูล)

```sql
-- #7 โน้ตลับของร้าน (ซ่อนจากลูกค้า) ต่อแมว
alter table cats add column if not exists staff_private_note text;

-- ให้ PostgREST รู้จักคอลัมน์ใหม่
notify pgrst, 'reload schema';
```
