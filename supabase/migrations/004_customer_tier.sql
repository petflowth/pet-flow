-- ระดับลูกค้า: ใหม่ / ประจำ / Member / VIP
alter table customers
  add column if not exists tier text not null default 'new'
  check (tier in ('new', 'regular', 'member', 'vip'));

create index if not exists customers_tier_idx on customers(tier);
