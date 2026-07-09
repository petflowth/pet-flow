-- อายุน้องแมวแบบคำนวณได้: เก็บอายุ ณ วันที่บันทึก (age_value + age_unit ปี/เดือน + age_as_of)
-- ระบบจะบวกเวลาที่ผ่านไปเพื่อได้อายุปัจจุบัน (ถ้ามีวันเกิดจะคำนวณจากวันเกิดแทน)
alter table cats
  add column if not exists age_value integer,
  add column if not exists age_unit text,
  add column if not exists age_as_of date;
