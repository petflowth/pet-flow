-- วันเกิดน้องแมว (ไม่บังคับ — ถ้าไม่ทราบก็เว้นได้)
alter table cats add column if not exists birthday date;
