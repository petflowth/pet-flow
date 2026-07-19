-- ข้อมูลตัวอย่างสำหรับ "เดโมสด" เท่านั้น — ห้ามรันบนเครื่องของร้านจริง
-- เครื่องที่ให้ลูกค้าทดลองใช้ ไม่ต้องรันไฟล์นี้ ปล่อยให้ว่างเปล่า
-- ข้อมูลเริ่มต้น (รันครั้งเดียว)
insert into customers (id, name, line_user_id, is_member, member_credit)
values ('C001', 'คุณมาย', 'dev-user', false, 0)
on conflict (id) do nothing;

insert into cats (id, customer_id, name, staff_note)
values ('CAT001', 'C001', 'น้องส้ม', 'อาบง่าย ไม่ดุ')
on conflict (id) do nothing;

insert into bookings (id, customer_name, cat_name, service, date, time, status, line_user_id)
values ('B001', 'คุณมาย', 'น้องส้ม', 'groom', '2026-07-23', '12:30', 'pending', 'dev-user')
on conflict (id) do nothing;

insert into points_accounts (line_user_id, display_name, points)
values ('dev-user', 'คุณทดสอบ', 42)
on conflict (line_user_id) do nothing;

insert into promos (id, title_th, title_en, body_th, body_en, start_date, until, active)
values
  ('P1', 'สมาชิกใหม่ รับแต้ม x2', 'New member double points',
   'จองครั้งแรกรับแต้มสะสม 2 เท่า 🧡', 'First booking earns 2x loyalty points 🧡',
   '2026-01-01', '2026-08-31', true),
  ('P2', 'พัก 7 คืนขึ้นไป ฟรีกล้อง CCTV', '7+ nights free CCTV',
   'ห้อง MiNi Meow / Mid Cozy / Cat Tower รับฟรีกล้องวงจรปิด',
   'MiNi Meow, Mid Cozy & Cat Tower — free CCTV for 7+ nights',
   '2026-01-01', '2026-12-31', true)
on conflict (id) do nothing;

