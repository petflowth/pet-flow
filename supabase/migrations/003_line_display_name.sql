-- แยกชื่อใน LINE กับชื่อที่ร้านตั้งเอง
alter table customers add column if not exists line_display_name text;
