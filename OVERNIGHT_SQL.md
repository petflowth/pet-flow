# ตั้งค่าฐานข้อมูล — รันครั้งเดียว (ครั้งสุดท้ายที่ต้องแตะ SQL)

ตั้งแต่นี้ไป **ไม่ต้องมานั่ง paste SQL ทุกครั้ง**ที่มีฟีเจอร์ใหม่แล้ว
แอปจะเติมคอลัมน์/ตารางที่ต้องใช้ให้เองผ่านปุ่ม **"🔄 อัปเดตฐานข้อมูล"**
(ตั้งค่า → ขั้นสูง) และรันอัตโนมัติทุกครั้งที่เปิดหลังบ้าน

แต่ต้อง **ตั้งค่าครั้งแรกครั้งเดียว** ให้แอปมีสิทธิ์แก้โครงสร้าง DB ก่อน:

## วิธีตั้งค่าครั้งแรก
1. เข้า https://supabase.com/dashboard/project/nqperjfuuntbzskbrqql → **SQL Editor** → **New query**
2. วางบล็อกด้านล่าง → **Run** (สร้างตัวช่วย + ล็อกให้เรียกได้เฉพาะเซิร์ฟเวอร์)
3. กลับมาที่แอป → ตั้งค่า → ขั้นสูง → กด **"🔄 อัปเดตฐานข้อมูลตอนนี้"** → เสร็จ!

```sql
-- ตั้งค่าครั้งเดียว: ให้แอปอัปเดตฐานข้อมูลเองได้
create or replace function public.exec_sql(sql text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  execute sql;
end;
$$;

-- ล็อก: เรียกได้เฉพาะ service role (ฝั่งเซิร์ฟเวอร์เท่านั้น)
revoke all on function public.exec_sql(text) from public;
grant execute on function public.exec_sql(text) to service_role;

notify pgrst, 'reload schema';
```

## หลังจากนั้น
- ปุ่ม "🔄 อัปเดตฐานข้อมูล" จะเติมคอลัมน์ที่ค้างให้เอง (deposit_credit,
  staff_private_note, consent_accepted_at และของใหม่ในอนาคต)
- ฟีเจอร์ใหม่ที่ต้องใช้คอลัมน์เพิ่ม → แค่เพิ่มใน `webapp/src/lib/migrations.ts`
  แล้วมันจะรันเองตอนเปิดหลังบ้าน ไม่ต้องแตะ Supabase อีก

> รายการ migration ทั้งหมดอยู่ใน `webapp/src/lib/migrations.ts` (ปลอดภัย idempotent)
