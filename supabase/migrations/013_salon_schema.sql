-- ระบบร้านทำผม (รุ่นแรก) — แยกไว้ใน schema "salon" ไม่ปนกับตารางของร้านสัตว์เลี้ยงใน public
--
-- ทุกตารางมี shop_id (= tenants.id ของร้าน) และตารางที่ผูกกับสถานที่มี branch_id ไว้รอหลายสาขา
-- ไม่ผูก foreign key ไปที่ public.tenants ตั้งใจ: ร้าน bootstrap เดิมไม่มีแถวใน tenants
-- และวันหนึ่งจะย้าย schema นี้ไปโปรเจกต์ Supabase ของตัวเอง (pg_dump --schema=salon แล้วรันไฟล์นี้)
--
-- รันซ้ำได้ (idempotent) — ใช้ if not exists / create or replace ทั้งหมด
--
-- หลังรัน ต้องเปิดให้ API มองเห็น schema นี้ 1 ครั้ง:
--   Supabase → Project Settings → Data API → Exposed schemas → เพิ่ม "salon" → Save
-- ไม่งั้นแอปจะได้ error "The schema must be one of the following"

create extension if not exists btree_gist;

create schema if not exists salon;

-- ───────────── ตั้งค่าร้าน (ค่าเดียวต่อร้าน เก็บเป็น jsonb ให้เพิ่มค่าใหม่ได้โดยไม่ต้อง migrate)
create table if not exists salon.settings (
  shop_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- ───────────── ช่าง / ผู้ช่วย
create table if not exists salon.stylists (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  branch_id text,
  name text not null,
  level text not null default 'stylist',          -- stylist | senior | assistant
  commission_pct numeric(5,2),                     -- null = ใช้ค่าตั้งต้นของร้าน
  color text,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists stylists_shop on salon.stylists (shop_id, active);

-- ───────────── บริการ
create table if not exists salon.services (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  category text not null default 'ตัด',
  name text not null,
  price numeric(12,2) not null default 0,
  price_from boolean not null default false,       -- true = "เริ่มต้น" ต้องยืนยันราคาจริงก่อนเริ่ม
  duration_min int not null default 30,
  wait_min int not null default 0,                 -- ช่วงรอ (เช่น รอสี) ที่ช่างว่างไปรับงานอื่นได้
  wait_after_min int not null default 0,           -- ช่วงรอเริ่มหลังลงมือไปกี่นาที
  needs_deposit boolean not null default false,
  rebook_days int,                                 -- รอบเตือนกลับมา (วัน)
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists services_shop on salon.services (shop_id, active);

-- ───────────── ลูกค้า
create table if not exists salon.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  name text not null,
  nickname text,
  phone text,
  line_id text,
  birthday text,                                   -- MM-DD (ไม่เก็บปี)
  hair_length text,                                -- short | medium | long | xlong
  allergies text,                                  -- ข้อมูลอ่อนไหว — ช่างเห็นเฉพาะตอนลูกค้าอยู่ในคิว
  color_formula text,
  notes text,
  marketing_consent boolean not null default false,
  photo_consent boolean not null default false,
  points int not null default 0,                   -- ยอดคงเหลือ (คำนวณจาก points_ledger เสมอ ผ่าน salon.add_points)
  no_show_count int not null default 0,
  merged_into uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists customers_shop_phone on salon.customers (shop_id, phone)
  where phone is not null and phone <> '' and deleted_at is null and merged_into is null;
create index if not exists customers_shop_name on salon.customers (shop_id, name);

-- ───────────── การมาใช้บริการ 1 ครั้ง (ทั้งนัดล่วงหน้าและ walk-in)
create table if not exists salon.visits (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  branch_id text,
  customer_id uuid references salon.customers(id),
  guest_name text,                                 -- walk-in ที่ไม่บอกชื่อ/ไม่สมัคร
  source text not null default 'booking',          -- booking | walk_in
  status text not null default 'booked',
  -- booked | confirmed | arrived | waiting | in_service | awaiting_payment | done | cancelled | no_show
  start_at timestamptz not null,
  end_at timestamptz not null,
  stylist_id uuid references salon.stylists(id),
  queue_no int,
  hair_length text,
  note text,
  deposit_required numeric(12,2) not null default 0,
  cancel_reason text,
  arrived_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_by text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists visits_shop_day on salon.visits (shop_id, start_at);
create index if not exists visits_customer on salon.visits (customer_id, start_at desc);

create table if not exists salon.visit_services (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  visit_id uuid not null references salon.visits(id) on delete cascade,
  service_id uuid references salon.services(id),
  name text not null,
  quoted_price numeric(12,2) not null default 0,
  final_price numeric(12,2),
  price_from boolean not null default false,
  price_confirmed_by text,
  duration_min int not null default 30,
  wait_min int not null default 0,
  wait_after_min int not null default 0,
  stylist_id uuid references salon.stylists(id),
  assistant_id uuid references salon.stylists(id),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists visit_services_visit on salon.visit_services (visit_id);

-- ช่วงเวลาที่ช่างติดงานจริง — exclusion constraint คือด่านสุดท้ายกันจองซ้อน แม้ 2 เครื่องกดพร้อมกัน
create table if not exists salon.visit_slots (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  visit_id uuid not null references salon.visits(id) on delete cascade,
  stylist_id uuid not null references salon.stylists(id),
  period tstzrange not null
);
do $$ begin
  alter table salon.visit_slots add constraint visit_slots_no_overlap
    exclude using gist (shop_id with =, stylist_id with =, period with &&);
exception when duplicate_object or duplicate_table then null; end $$;
create index if not exists visit_slots_visit on salon.visit_slots (visit_id);

-- ───────────── สินค้าขาย
create table if not exists salon.products (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  name text not null,
  price numeric(12,2) not null default 0,
  cost numeric(12,2) not null default 0,
  stock int not null default 0,
  reorder_point int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists products_shop on salon.products (shop_id, active);

-- ───────────── บิล
create table if not exists salon.bills (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  branch_id text,
  visit_id uuid references salon.visits(id),          -- 1 คิว = 1 บิลที่ยังไม่ยกเลิก (ดู bills_visit_live)
  bill_no int not null,
  customer_id uuid references salon.customers(id),
  subtotal numeric(12,2) not null,
  discount numeric(12,2) not null default 0,
  points_used int not null default 0,
  points_value numeric(12,2) not null default 0,
  total numeric(12,2) not null,                        -- ยอดสุทธิ (รายได้)
  deposit_applied numeric(12,2) not null default 0,
  paid numeric(12,2) not null default 0,
  points_earned int not null default 0,
  status text not null default 'paid',                 -- partially_paid | paid | void
  void_reason text,
  voided_by text,
  idem_key text unique,
  created_by text,
  created_at timestamptz not null default now()
);
create unique index if not exists bills_shop_no on salon.bills (shop_id, bill_no);
-- กันเปิดบิลซ้ำให้คิวเดียวกัน แต่ยกเลิกบิลแล้วเปิดใหม่ได้
create unique index if not exists bills_visit_live on salon.bills (visit_id) where status <> 'void';
create index if not exists bills_shop_day on salon.bills (shop_id, created_at);

create table if not exists salon.bill_lines (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  bill_id uuid not null references salon.bills(id) on delete cascade,
  kind text not null,                                  -- service | product
  ref_id uuid,
  name text not null,
  qty int not null default 1,
  unit_price numeric(12,2) not null,
  amount numeric(12,2) not null,                       -- qty × unit_price
  net numeric(12,2) not null,                          -- หลังกระจายส่วนลด+แต้มตามสัดส่วน
  stylist_id uuid references salon.stylists(id),
  assistant_id uuid references salon.stylists(id)
);
create index if not exists bill_lines_bill on salon.bill_lines (bill_id);

create table if not exists salon.payments (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  branch_id text,
  visit_id uuid references salon.visits(id),
  bill_id uuid references salon.bills(id),
  kind text not null,                                  -- deposit | payment | refund
  method text not null,                                -- cash | transfer | card
  amount numeric(12,2) not null,                       -- ติดลบ = คืนเงิน
  fee_amount numeric(12,2) not null default 0,         -- ค่าธรรมเนียมบัตร (ประมาณการ)
  reference text,                                      -- เลขอ้างอิงโอน / เลขอนุมัติบัตร
  card_last4 text,
  idem_key text unique,                                -- กันกดรับเงินซ้ำ
  received_by text,
  created_at timestamptz not null default now()
);
create index if not exists payments_shop_day on salon.payments (shop_id, created_at);
create index if not exists payments_visit on salon.payments (visit_id);

create table if not exists salon.commissions (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  bill_id uuid not null references salon.bills(id),
  stylist_id uuid not null references salon.stylists(id),
  base numeric(12,2) not null,
  pct numeric(5,2) not null,
  amount numeric(12,2) not null,
  reversal boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists commissions_shop_day on salon.commissions (shop_id, created_at);

create table if not exists salon.points_ledger (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  customer_id uuid not null references salon.customers(id),
  delta int not null,
  reason text not null,                                -- earn | redeem | reverse | adjust | expire
  bill_id uuid references salon.bills(id),
  expires_at timestamptz,
  by_user text,
  created_at timestamptz not null default now()
);
create index if not exists points_ledger_customer on salon.points_ledger (customer_id, created_at);

create table if not exists salon.day_closings (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  branch_id text,
  day date not null,
  expected jsonb not null,                             -- ยอดตามระบบแยกวิธีจ่าย
  counted_cash numeric(12,2),
  edc_total numeric(12,2),
  note text,
  closed_by text,
  created_at timestamptz not null default now()
);
create index if not exists day_closings_shop_day on salon.day_closings (shop_id, day);

create table if not exists salon.audit_log (
  id bigserial primary key,
  shop_id text not null,
  actor text,
  action text not null,
  entity text not null,
  entity_id text,
  reason text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_shop_day on salon.audit_log (shop_id, created_at desc);

-- ───────────── ฟังก์ชันที่ต้องทำหลายตารางพร้อมกัน (ทำในธุรกรรมเดียว — สำเร็จทั้งหมดหรือไม่เกิดอะไรเลย)

-- เลขบิลถัดไปของร้าน
create or replace function salon.next_bill_no(p_shop text) returns int
language sql as $$
  select coalesce(max(bill_no), 0) + 1 from salon.bills where shop_id = p_shop
$$;

-- ปิดบิล: เขียนบิล บรรทัด การชำระ ค่าคอม แต้ม สต็อก สถานะคิว ในธุรกรรมเดียว
-- ส่ง idem_key เดิมซ้ำ (กดซ้ำ/เน็ตกระตุก) = คืนบิลเดิม ไม่สร้างใหม่
create or replace function salon.checkout(p jsonb) returns jsonb
language plpgsql as $$
declare
  v_shop text := p->>'shop_id';
  v_bill uuid;
  v_existing uuid;
  v_no int;
  v_visit uuid := nullif(p->>'visit_id', '')::uuid;
  v_customer uuid := nullif(p->>'customer_id', '')::uuid;
  v_points_used int := coalesce((p->>'points_used')::int, 0);
  v_points_earned int := coalesce((p->>'points_earned')::int, 0);
  v_balance int;
  l jsonb;
  pay jsonb;
  c jsonb;
  v_line uuid;
begin
  select id into v_existing from salon.bills where idem_key = p->>'idem_key';
  if v_existing is not null then
    return jsonb_build_object('bill_id', v_existing, 'duplicate', true);
  end if;

  if v_visit is not null then
    select id into v_existing from salon.bills where visit_id = v_visit and status <> 'void';
    if v_existing is not null then
      raise exception 'bill_exists' using errcode = 'P0001';
    end if;
  end if;

  if v_points_used > 0 then
    if v_customer is null then raise exception 'points_no_customer' using errcode = 'P0001'; end if;
    select points into v_balance from salon.customers where id = v_customer and shop_id = v_shop for update;
    if coalesce(v_balance, 0) < v_points_used then
      raise exception 'points_not_enough' using errcode = 'P0001';
    end if;
  end if;

  -- กันเลขบิลชนกันเมื่อ 2 เครื่องปิดบิลพร้อมกัน
  perform pg_advisory_xact_lock(hashtext('salon-bill-' || v_shop));
  v_no := salon.next_bill_no(v_shop);

  insert into salon.bills (shop_id, branch_id, visit_id, bill_no, customer_id, subtotal, discount,
    points_used, points_value, total, deposit_applied, paid, points_earned, status, idem_key, created_by)
  values (v_shop, nullif(p->>'branch_id', ''), v_visit, v_no, v_customer,
    (p->>'subtotal')::numeric, (p->>'discount')::numeric, v_points_used, (p->>'points_value')::numeric,
    (p->>'total')::numeric, (p->>'deposit_applied')::numeric, (p->>'paid')::numeric, v_points_earned,
    p->>'status', p->>'idem_key', p->>'by')
  returning id into v_bill;

  for l in select * from jsonb_array_elements(coalesce(p->'lines', '[]'::jsonb)) loop
    insert into salon.bill_lines (shop_id, bill_id, kind, ref_id, name, qty, unit_price, amount, net, stylist_id, assistant_id)
    values (v_shop, v_bill, l->>'kind', nullif(l->>'ref_id', '')::uuid, l->>'name', (l->>'qty')::int,
      (l->>'unit_price')::numeric, (l->>'amount')::numeric, (l->>'net')::numeric,
      nullif(l->>'stylist_id', '')::uuid, nullif(l->>'assistant_id', '')::uuid)
    returning id into v_line;
    if l->>'kind' = 'product' and nullif(l->>'ref_id', '') is not null then
      update salon.products set stock = stock - (l->>'qty')::int
       where id = (l->>'ref_id')::uuid and shop_id = v_shop;
    end if;
  end loop;

  -- มัดจำที่จ่ายไว้ก่อน ผูกเข้าบิลนี้
  if v_visit is not null then
    update salon.payments set bill_id = v_bill
     where visit_id = v_visit and kind = 'deposit' and bill_id is null and shop_id = v_shop;
  end if;

  for pay in select * from jsonb_array_elements(coalesce(p->'payments', '[]'::jsonb)) loop
    insert into salon.payments (shop_id, branch_id, visit_id, bill_id, kind, method, amount, fee_amount,
      reference, card_last4, idem_key, received_by)
    values (v_shop, nullif(p->>'branch_id', ''), v_visit, v_bill, 'payment', pay->>'method',
      (pay->>'amount')::numeric, coalesce((pay->>'fee_amount')::numeric, 0), nullif(pay->>'reference', ''),
      nullif(pay->>'card_last4', ''), (p->>'idem_key') || ':' || (pay->>'seq'), p->>'by');
  end loop;

  for c in select * from jsonb_array_elements(coalesce(p->'commissions', '[]'::jsonb)) loop
    insert into salon.commissions (shop_id, bill_id, stylist_id, base, pct, amount)
    values (v_shop, v_bill, (c->>'stylist_id')::uuid, (c->>'base')::numeric, (c->>'pct')::numeric, (c->>'amount')::numeric);
  end loop;

  if v_customer is not null and v_points_used > 0 then
    insert into salon.points_ledger (shop_id, customer_id, delta, reason, bill_id, by_user)
    values (v_shop, v_customer, -v_points_used, 'redeem', v_bill, p->>'by');
  end if;
  if v_customer is not null and v_points_earned > 0 then
    insert into salon.points_ledger (shop_id, customer_id, delta, reason, bill_id, expires_at, by_user)
    values (v_shop, v_customer, v_points_earned, 'earn', v_bill,
      now() + make_interval(months => coalesce((p->>'points_expire_months')::int, 12)), p->>'by');
  end if;
  if v_customer is not null then
    update salon.customers set points = points - v_points_used + v_points_earned, updated_at = now()
     where id = v_customer and shop_id = v_shop;
  end if;

  if v_visit is not null and p->>'status' = 'paid' then
    update salon.visits set status = 'done', finished_at = coalesce(finished_at, now()),
      updated_at = now(), version = version + 1
     where id = v_visit and shop_id = v_shop;
  end if;

  insert into salon.audit_log (shop_id, actor, action, entity, entity_id, detail)
  values (v_shop, p->>'by', 'checkout', 'bill', v_bill::text,
    jsonb_build_object('bill_no', v_no, 'total', p->>'total', 'paid', p->>'paid'));

  return jsonb_build_object('bill_id', v_bill, 'bill_no', v_no, 'duplicate', false);
end $$;

-- ยกเลิกบิล: คืนสต็อก ค่าคอมติดลบ คืนแต้ม บันทึกเงินคืน — ไม่ลบบิลเดิม
create or replace function salon.void_bill(p jsonb) returns jsonb
language plpgsql as $$
declare
  v_shop text := p->>'shop_id';
  b salon.bills%rowtype;
  l salon.bill_lines%rowtype;
  pay record;
begin
  select * into b from salon.bills where id = (p->>'bill_id')::uuid and shop_id = v_shop for update;
  if b.id is null then raise exception 'bill_not_found' using errcode = 'P0001'; end if;
  if b.status = 'void' then return jsonb_build_object('bill_id', b.id, 'duplicate', true); end if;

  update salon.bills set status = 'void', void_reason = p->>'reason', voided_by = p->>'by' where id = b.id;

  for l in select * from salon.bill_lines where bill_id = b.id loop
    if l.kind = 'product' and l.ref_id is not null then
      update salon.products set stock = stock + l.qty where id = l.ref_id and shop_id = v_shop;
    end if;
  end loop;

  insert into salon.commissions (shop_id, bill_id, stylist_id, base, pct, amount, reversal)
  select shop_id, bill_id, stylist_id, -base, pct, -amount, true
    from salon.commissions where bill_id = b.id and reversal = false;

  -- เงินคืนตามวิธีที่จ่ายมา (บัตรต้องไปทำคืนที่เครื่อง EDC ด้วย)
  for pay in select method, sum(amount) as amt from salon.payments where bill_id = b.id group by method loop
    if pay.amt <> 0 then
      insert into salon.payments (shop_id, branch_id, visit_id, bill_id, kind, method, amount, reference, received_by)
      values (v_shop, b.branch_id, b.visit_id, b.id, 'refund', pay.method, -pay.amt, p->>'reference', p->>'by');
    end if;
  end loop;

  if b.customer_id is not null then
    if b.points_used > 0 then
      insert into salon.points_ledger (shop_id, customer_id, delta, reason, bill_id, expires_at, by_user)
      values (v_shop, b.customer_id, b.points_used, 'reverse', b.id, now() + interval '30 days', p->>'by');
    end if;
    if b.points_earned > 0 then
      insert into salon.points_ledger (shop_id, customer_id, delta, reason, bill_id, by_user)
      values (v_shop, b.customer_id, -b.points_earned, 'reverse', b.id, p->>'by');
    end if;
    update salon.customers set points = points + b.points_used - b.points_earned, updated_at = now()
     where id = b.customer_id and shop_id = v_shop;
  end if;

  -- คิวกลับไปรอเก็บเงิน เปิดบิลใหม่ที่ถูกต้องได้
  if b.visit_id is not null then
    update salon.visits set status = 'awaiting_payment', updated_at = now(), version = version + 1
     where id = b.visit_id and shop_id = v_shop;
  end if;

  insert into salon.audit_log (shop_id, actor, action, entity, entity_id, reason, detail)
  values (v_shop, p->>'by', 'void_bill', 'bill', b.id::text, p->>'reason',
    jsonb_build_object('bill_no', b.bill_no, 'total', b.total));

  return jsonb_build_object('bill_id', b.id, 'duplicate', false);
end $$;

-- บันทึกคิว (สร้างใหม่หรือแก้) พร้อมรายการบริการและช่วงเวลาช่างในธุรกรรมเดียว
-- ช่วงเวลาชนกับคิวอื่นของช่างคนเดียวกัน → exclusion constraint โยน 23P01 ทั้งก้อนย้อนกลับ
-- ส่ง version มาด้วยตอนแก้ — ถ้าเครื่องอื่นแก้ไปก่อนแล้วจะโยน 'stale' ไม่ทับกัน
create or replace function salon.save_visit(p jsonb) returns jsonb
language plpgsql as $$
declare
  v_shop text := p->>'shop_id';
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_day date := (p->>'day')::date;
  v_queue int;
  v_ver int;
  s jsonb;
  sl jsonb;
  i int := 0;
begin
  if v_id is null then
    if p->>'source' = 'walk_in' then
      perform pg_advisory_xact_lock(hashtext('salon-queue-' || v_shop));
      select coalesce(max(queue_no), 0) + 1 into v_queue from salon.visits
       where shop_id = v_shop and source = 'walk_in'
         and (start_at at time zone 'Asia/Bangkok')::date = v_day;
    end if;
    insert into salon.visits (shop_id, branch_id, customer_id, guest_name, source, status, start_at, end_at,
      stylist_id, queue_no, hair_length, note, deposit_required, created_by, arrived_at)
    values (v_shop, nullif(p->>'branch_id', ''), nullif(p->>'customer_id', '')::uuid, nullif(p->>'guest_name', ''),
      coalesce(p->>'source', 'booking'), coalesce(p->>'status', 'booked'),
      (p->>'start_at')::timestamptz, (p->>'end_at')::timestamptz, nullif(p->>'stylist_id', '')::uuid,
      v_queue, nullif(p->>'hair_length', ''), nullif(p->>'note', ''),
      coalesce((p->>'deposit_required')::numeric, 0), p->>'by',
      case when p->>'source' = 'walk_in' then now() end)
    returning id into v_id;
  else
    select version into v_ver from salon.visits where id = v_id and shop_id = v_shop for update;
    if v_ver is null then raise exception 'not_found' using errcode = 'P0001'; end if;
    if p ? 'version' and (p->>'version')::int <> v_ver then
      raise exception 'stale' using errcode = 'P0001';
    end if;
    update salon.visits set
      start_at = (p->>'start_at')::timestamptz,
      end_at = (p->>'end_at')::timestamptz,
      stylist_id = nullif(p->>'stylist_id', '')::uuid,
      deposit_required = coalesce((p->>'deposit_required')::numeric, deposit_required),
      note = case when p ? 'note' then nullif(p->>'note', '') else note end,
      updated_at = now(), version = version + 1
     where id = v_id;
    delete from salon.visit_services where visit_id = v_id;
    delete from salon.visit_slots where visit_id = v_id;
  end if;

  for s in select * from jsonb_array_elements(coalesce(p->'services', '[]'::jsonb)) loop
    insert into salon.visit_services (shop_id, visit_id, service_id, name, quoted_price, final_price, price_from,
      price_confirmed_by, duration_min, wait_min, wait_after_min, stylist_id, assistant_id, sort)
    values (v_shop, v_id, nullif(s->>'service_id', '')::uuid, s->>'name', coalesce((s->>'quoted_price')::numeric, 0),
      (s->>'final_price')::numeric, coalesce((s->>'price_from')::boolean, false), nullif(s->>'price_confirmed_by', ''),
      coalesce((s->>'duration_min')::int, 30), coalesce((s->>'wait_min')::int, 0), coalesce((s->>'wait_after_min')::int, 0),
      nullif(s->>'stylist_id', '')::uuid, nullif(s->>'assistant_id', '')::uuid, i);
    i := i + 1;
  end loop;

  for sl in select * from jsonb_array_elements(coalesce(p->'slots', '[]'::jsonb)) loop
    insert into salon.visit_slots (shop_id, visit_id, stylist_id, period)
    values (v_shop, v_id, (sl->>'stylist_id')::uuid,
      tstzrange((sl->>'from')::timestamptz, (sl->>'to')::timestamptz, '[)'));
  end loop;

  return jsonb_build_object('id', v_id, 'queue_no', v_queue);
end $$;

-- ───────────── สิทธิ์: เข้าถึงได้เฉพาะเซิร์ฟเวอร์ (service_role) เหมือนตาราง public — anon อ่านไม่ได้
grant usage on schema salon to service_role;
grant all on all tables in schema salon to service_role;
grant all on all sequences in schema salon to service_role;
grant execute on all functions in schema salon to service_role;
alter default privileges in schema salon grant all on tables to service_role;
alter default privileges in schema salon grant all on sequences to service_role;
alter default privileges in schema salon grant execute on functions to service_role;
revoke all on schema salon from anon, authenticated;

do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'salon' loop
    execute format('alter table salon.%I enable row level security', r.tablename);
  end loop;
end $$;

notify pgrst, 'reload schema';
