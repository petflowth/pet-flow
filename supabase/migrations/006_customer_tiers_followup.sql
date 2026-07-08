-- ติดตามลูกค้าที่หายไปนาน (ส่งข้อความตามทาง LINE)
alter table customers
  add column if not exists last_follow_up_at timestamptz;
