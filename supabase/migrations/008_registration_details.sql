-- ข้อมูลลงทะเบียนเพิ่มเติม
-- ผู้ปกครอง: อีเมล · วันเกิด · ยินยอมรับข่าวสาร/โปร (default ยินยอม) · รู้จักจากทางไหน
-- น้องแมว: เพศ · พันธุ์ · อายุ · โรคประจำตัว
alter table customers
  add column if not exists email text,
  add column if not exists birthday date,
  add column if not exists marketing_consent boolean not null default true,
  add column if not exists referral_source text;

alter table cats
  add column if not exists gender text,
  add column if not exists breed text,
  add column if not exists age text,
  add column if not exists medical text;
