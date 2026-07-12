-- มัดจำในบิล + ตารางรูป broadcast
-- หมายเหตุ: โปรดักชันถูกรีเซ็ต schema ให้ตรงกับโค้ด (id เป็น text) เมื่อ 2026-07-09
-- เพราะฐานข้อมูลเดิมเป็นของแอปเวอร์ชันเก่า (id เป็น uuid + ตาราง bills/app_settings)
alter table invoices add column if not exists deposit numeric not null default 0;

create table if not exists broadcast_images (
  id text primary key,
  data text not null,
  content_type text not null default 'image/jpeg',
  created_at timestamptz not null default now()
);
create index if not exists broadcast_images_created_at_idx on broadcast_images(created_at);

-- ⚠️ ปิดการเปิด RLS ไว้ (2026-07-12)
-- เดิมเปิด RLS โดยคาดว่าแอปใช้ service role (bypass ได้) แต่ deployment จริง
-- เชื่อม Supabase ด้วย key ที่ไม่ bypass RLS → เขียนข้อมูลไม่ได้เลย (ทุกตารางว่าง)
-- แอปเข้าถึง DB ผ่านฝั่งเซิร์ฟเวอร์เท่านั้น (ไม่มี Supabase client ฝั่ง browser)
-- จึงปิด RLS เพื่อให้ระบบทำงาน อย่าเปิดใหม่จนกว่าจะตั้ง service role key ให้ถูกต้อง
-- alter table if exists customers enable row level security;
-- alter table if exists cats enable row level security;
-- alter table if exists bookings enable row level security;
-- alter table if exists points_accounts enable row level security;
-- alter table if exists points_history enable row level security;
-- alter table if exists promos enable row level security;
-- alter table if exists promo_claims enable row level security;
-- alter table if exists finance_records enable row level security;
-- alter table if exists invoices enable row level security;
-- alter table if exists service_records enable row level security;
-- alter table if exists member_topups enable row level security;
-- alter table if exists site_config enable row level security;
-- alter table if exists broadcast_images enable row level security;
