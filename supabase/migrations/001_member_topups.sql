-- รันถ้าเคยสร้างตารางไปแล้วก่อนมี member_topups (Supabase SQL Editor)

create table if not exists member_topups (
  id text primary key,
  customer_id text not null references customers(id) on delete cascade,
  paid_amount numeric not null default 0,
  bonus_amount numeric not null default 0,
  credit_added numeric not null,
  balance_after numeric not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists member_topups_customer_id_idx on member_topups(customer_id);
