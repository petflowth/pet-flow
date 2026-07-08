-- ตั้ง tier ลูกค้าเอง + ติดตามลูกค้าที่หายไปนาน
alter table customers
  add column if not exists staff_tiers text[] not null default '{}',
  add column if not exists last_follow_up_at timestamptz;

create index if not exists customers_staff_tiers_idx on customers using gin (staff_tiers);
