-- โปรพิเศษลูกค้า: เงื่อนไข tier / ครั้งแรก / เดือน + บันทึกการกดใช้จากแอป

alter table promos
  add column if not exists kind text not null default 'display'
    check (kind in ('display', 'customer')),
  add column if not exists restriction text not null default 'none'
    check (restriction in ('none', 'first_visit', 'calendar_month')),
  add column if not exists valid_month text,
  add column if not exists tiers text[] not null default array['all']::text[],
  add column if not exists coupon_code text;

create table if not exists promo_claims (
  id text primary key,
  promo_id text not null references promos(id) on delete cascade,
  customer_id text not null references customers(id) on delete cascade,
  line_user_id text,
  customer_name text not null default '',
  promo_title text not null default '',
  source text not null default 'app' check (source in ('app', 'admin')),
  created_at timestamptz not null default now()
);

create index if not exists promo_claims_promo_id_idx on promo_claims(promo_id);
create index if not exists promo_claims_customer_id_idx on promo_claims(customer_id);
create unique index if not exists promo_claims_once_per_customer
  on promo_claims(promo_id, customer_id);
