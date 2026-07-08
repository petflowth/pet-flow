-- รันถ้าเคยสร้างตาราง bookings ไปแล้ว (เพิ่มสถานะยกเลิก)

alter table bookings drop constraint if exists bookings_status_check;
alter table bookings add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'cancelled'));
