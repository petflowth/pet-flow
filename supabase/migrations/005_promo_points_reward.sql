-- โปรแบบแต้ม: แต้มโบนัส / ตัวคูณแต้ม

alter table promos
  add column if not exists reward_type text not null default 'discount'
    check (reward_type in ('discount', 'points', 'both')),
  add column if not exists points_bonus integer,
  add column if not exists points_multiplier numeric;

alter table promo_claims
  add column if not exists points_awarded integer;
