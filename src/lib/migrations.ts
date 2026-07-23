import { getSupabase } from "./supabase/server";

/**
 * ระบบอัปเดตโครงสร้างฐานข้อมูลอัตโนมัติ (auto-migrate)
 * ------------------------------------------------------
 * แอปคุยกับ DB จริงผ่าน service key อยู่แล้ว แต่ supabase-js (PostgREST)
 * สั่ง DDL (ALTER TABLE) ตรงๆ ไม่ได้ จึงใช้ฟังก์ชัน exec_sql ใน DB เป็นตัวกลาง
 *
 * ตั้งค่าครั้งเดียว (ครั้งสุดท้ายที่ต้องแตะ SQL): รัน EXEC_SQL_BOOTSTRAP
 * ในหน้า SQL Editor ของ Supabase — สร้างฟังก์ชัน + ล็อกให้เรียกได้เฉพาะ
 * service role (ฝั่งเซิร์ฟเวอร์). หลังจากนั้นทุก migration จะรันเองผ่านปุ่ม
 * "อัปเดตฐานข้อมูล" หรืออัตโนมัติเมื่อเปิดหลังบ้าน.
 */

/** SQL ที่ผู้ใช้ต้องรันครั้งเดียวใน Supabase SQL Editor */
export const EXEC_SQL_BOOTSTRAP = `-- ตั้งค่าครั้งเดียว: ให้แอปอัปเดตฐานข้อมูลเองได้
create or replace function public.exec_sql(sql text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  execute sql;
end;
$$;

-- ล็อก: เรียกได้เฉพาะ service role (ฝั่งเซิร์ฟเวอร์เท่านั้น)
revoke all on function public.exec_sql(text) from public;
grant execute on function public.exec_sql(text) to service_role;

notify pgrst, 'reload schema';`;

/**
 * รายการ migration — ต้อง idempotent (รันซ้ำได้ ไม่พัง) เสมอ
 * ใช้ "add column if not exists" / "create table if not exists" เท่านั้น
 * เพิ่มฟีเจอร์ใหม่ที่ต้องใช้คอลัมน์ใหม่ → เพิ่มบรรทัดที่นี่ได้เลย
 */
export const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: "customers.deposit_credit",
    sql: "alter table customers add column if not exists deposit_credit numeric not null default 0;",
  },
  {
    name: "cats.staff_private_note",
    sql: "alter table cats add column if not exists staff_private_note text;",
  },
  {
    name: "bookings.consent_accepted_at",
    sql: "alter table bookings add column if not exists consent_accepted_at timestamptz;",
  },
  {
    name: "bookings.care_note",
    sql: "alter table bookings add column if not exists care_note text;",
  },
  {
    name: "invoices.deleted_at",
    sql: "alter table invoices add column if not exists deleted_at timestamptz;",
  },
  {
    name: "customers.deleted_at",
    sql: "alter table customers add column if not exists deleted_at timestamptz;",
  },
  {
    name: "bookings.arrival_time",
    sql: "alter table bookings add column if not exists arrival_time text;",
  },
  {
    name: "bookings.pickup_time",
    sql: "alter table bookings add column if not exists pickup_time text;",
  },
  {
    name: "invoices.deposit_received_at",
    sql: "alter table invoices add column if not exists deposit_received_at timestamptz;",
  },
  {
    name: "bookings.groom_health_info",
    sql: "alter table bookings add column if not exists groom_health_info text;",
  },
  {
    name: "cats.groom_health_info",
    sql: "alter table cats add column if not exists groom_health_info text;",
  },
  // ── ฟอร์มลงทะเบียนสมาชิก (ผู้ปกครอง + น้องแมว) ──
  {
    name: "customers.registration_details",
    sql: "alter table customers add column if not exists email text, add column if not exists birthday date, add column if not exists marketing_consent boolean not null default true, add column if not exists referral_source text;",
  },
  {
    name: "cats.registration_details",
    sql: "alter table cats add column if not exists gender text, add column if not exists breed text, add column if not exists age text, add column if not exists medical text;",
  },
  {
    name: "cats.birthday",
    sql: "alter table cats add column if not exists birthday date;",
  },
  {
    name: "cats.age_structured",
    sql: "alter table cats add column if not exists age_value integer, add column if not exists age_unit text, add column if not exists age_as_of date;",
  },
  // ── ระบบคูปอง + ชวนเพื่อน ──
  {
    name: "customers.referral_code",
    sql: "alter table customers add column if not exists referral_code text, add column if not exists referred_by text;",
  },
  {
    name: "coupons.table",
    sql: "create table if not exists coupons (id text primary key, code text, customer_id text, amount numeric not null default 0, reason text, status text not null default 'active', expires_at timestamptz, used_at timestamptz, used_invoice_id text, created_at timestamptz not null default now());",
  },
  {
    name: "coupons.offer_id",
    sql: "alter table coupons add column if not exists offer_id text;",
  },
  {
    name: "coupon_offers.table",
    sql: "create table if not exists coupon_offers (id text primary key, title text, amount numeric not null default 0, reason text, valid_days integer not null default 60, active boolean not null default true, created_at timestamptz not null default now());",
  },
  {
    name: "customer_packages.table",
    sql: "create table if not exists customer_packages (id text primary key, customer_id text, name text, total_uses integer not null default 0, used_uses integer not null default 0, price numeric not null default 0, status text not null default 'active', created_at timestamptz not null default now());",
  },
  {
    name: "cats.media",
    sql: "alter table cats add column if not exists media jsonb not null default '[]'::jsonb;",
  },
  {
    name: "chat_watch.table",
    sql: "create table if not exists chat_watch (line_user_id text primary key, last_message_at timestamptz, last_notified_at timestamptz);",
  },
  {
    name: "bookings.consent_signature",
    sql: "alter table bookings add column if not exists consent_signature text;",
  },
  {
    name: "cats.fur_length",
    sql: "alter table cats add column if not exists fur_length text;",
  },
  {
    name: "customers.address",
    sql: "alter table customers add column if not exists address text, add column if not exists address_map_url text;",
  },
  {
    name: "customers.postal_code",
    sql: "alter table customers add column if not exists postal_code text;",
  },
  {
    name: "articles.table",
    sql: "create table if not exists articles (id text primary key, slug text not null, title text not null, description text, body text, cover_url text, emoji text, published boolean not null default true, date_published date, created_at timestamptz not null default now());",
  },
  {
    name: "staff_users.table",
    sql: "create table if not exists staff_users (id text primary key, name text not null, code text not null, menus jsonb not null default '[]'::jsonb, active boolean not null default true, created_at timestamptz not null default now());",
  },
  {
    // ย้ายจากล็อกอินด้วยรหัส PIN (code) มาเป็น username+password ต่อร้าน — ตารางเดิม (โหมดเดี่ยว
    // ก่อนมี multi-tenant) ยังไม่มีคอลัมน์พวกนี้เลย ทำให้เพิ่มพนักงานไม่ได้ (insert ชน code NOT NULL)
    name: "staff_users.tenant_login_columns",
    sql: "alter table staff_users add column if not exists tenant_id text, add column if not exists username text, add column if not exists password_hash text, add column if not exists password_salt text;",
  },
  {
    // code (PIN เดิม) เลิกใช้แล้ว แต่ตารางเก่ายังตั้ง NOT NULL ไว้ — insert แถวใหม่ที่ไม่มี code จะชน constraint นี้
    name: "staff_users.code_nullable",
    sql: "alter table staff_users alter column code drop not null;",
  },
  {
    name: "cats.color",
    sql: "alter table cats add column if not exists color text;",
  },
  {
    // รายชื่อข้อความอัตโนมัติที่ "นัดนี้" ไม่ต้องส่ง (ปิดเป็นรายเคส ไม่ใช่ปิดทั้งร้าน)
    name: "bookings.auto_off",
    sql: "alter table bookings add column if not exists auto_off text[] not null default array[]::text[];",
  },
  {
    // นัดที่ลูกค้าจองเองผ่านแอป — ต้องรอร้านยืนยัน (ลูกค้ายืนยันเองไม่ได้)
    name: "bookings.self_booked",
    sql: "alter table bookings add column if not exists self_booked boolean not null default false;",
  },
  {
    // โปรแกรมอาบน้ำที่เลือกไว้ตอนจอง (id ใน GROOM_PROGRAMS) — ให้ลิงก์ไปการ์ดแจ้งเตือน + ออกบิลได้เลย ไม่ต้องถามซ้ำ
    name: "bookings.groom_program",
    sql: "alter table bookings add column if not exists groom_program text;",
  },
  {
    // ยอดยกมาจากระบบเก่า — ไม่ใช่รายรับเดือนนี้ ต้องแยกได้ว่าเติมครั้งไหนเป็นยอดยกมา
    name: "member_topups.is_legacy",
    sql: "alter table member_topups add column if not exists is_legacy boolean not null default false;",
  },
  {
    // แพ็กเกจที่เปิดขายในแอปลูกค้า (ร้านตั้งเองว่าจะขายอะไรบ้าง)
    name: "package_offers.table",
    sql: "create table if not exists package_offers (id text primary key, name text, total_uses integer not null default 0, price numeric not null default 0, description text, active boolean not null default true, created_at timestamptz not null default now());",
  },
  {
    // ออร์เดอร์ที่ลูกค้ากดซื้อ — รอร้านยืนยันรับเงินก่อนถึงจะกลายเป็นคอร์สจริง
    name: "package_orders.table",
    sql: "create table if not exists package_orders (id text primary key, customer_id text, customer_name text, line_user_id text, offer_id text, name text, total_uses integer not null default 0, price numeric not null default 0, status text not null default 'pending', slip_url text, package_id text, created_at timestamptz not null default now(), paid_at timestamptz);",
  },
  {
    name: "package_orders.status_idx",
    sql: "create index if not exists package_orders_status_idx on package_orders(status);",
  },
  {
    // รูปหน้าปกคอร์สที่ลูกค้าเห็นในแอป
    name: "package_offers.image_url",
    sql: "alter table package_offers add column if not exists image_url text;",
  },
  {
    // ขายได้ 2 แบบ: "package" (คอร์ส N ครั้ง) หรือ "credit" (เติมเครดิต Member เป็นยอดเงิน)
    // credit_amount = เครดิตที่ลูกค้าจะได้รับ (ตั้งสูงกว่า price ได้เพื่อแถมโบนัส เช่น จ่าย 1000 ได้ 1200)
    name: "package_offers.kind_credit",
    sql: "alter table package_offers add column if not exists kind text not null default 'package', add column if not exists credit_amount numeric;",
  },
  {
    // ก๊อปชนิด+ยอดเครดิต ณ ตอนสั่งซื้อ ไว้ในออร์เดอร์เหมือน total_uses/price — กันร้านแก้ offer ทีหลังแล้วออร์เดอร์เก่าเพี้ยน
    name: "package_orders.kind_credit",
    sql: "alter table package_orders add column if not exists kind text not null default 'package', add column if not exists credit_amount numeric;",
  },
  {
    // คอร์สที่บิลนี้หักไป 1 ครั้ง — ใช้โชว์ประวัติการใช้คอร์ส + คืนครั้งตอนยกเลิกบิล
    name: "invoices.package_id",
    sql: "alter table invoices add column if not exists package_id text;",
  },
  {
    // รูปบิล/ใบเสร็จที่แนบกับรายการเงิน — หลักฐานตอนยื่นภาษี
    name: "finance_records.receipt_url",
    sql: "alter table finance_records add column if not exists receipt_url text;",
  },
  {
    // ล้างของเก่า: ตัดบรรทัด "ของแถมฟรี" (ขึ้นต้นด้วย 🎁) ที่เคยหลุดไปฝัง
    // ในโน้ตนิสัยแมว ออกให้หมด — ของแถมต้องผูกกับการจองแต่ละรอบ ไม่ใช่ข้อมูลถาวรของแมว
    // idempotent: พอล้างแล้วไม่มี 🎁 เหลือ WHERE ก็ไม่ match อะไร รันซ้ำได้
    // (รันด้วย service role ข้าม RLS → ล้างให้ทุกร้านทีเดียว)
    name: "cats.strip_freebie_from_staff_note",
    sql: `update cats
set staff_note = nullif(
  array_to_string(
    array(
      select l
      from unnest(string_to_array(staff_note, E'\\n')) as l
      where btrim(l) not like '🎁%'
    ),
    E'\\n'
  ),
  ''
)
where staff_note like '%🎁%';`,
  },
];

export type MigrateResult = {
  ok: boolean;
  bootstrapNeeded: boolean;
  applied: string[];
  errors: { name: string; error: string }[];
};

function looksLikeMissingFunction(msg: string) {
  return /exec_sql/i.test(msg) &&
    /(does not exist|could not find|schema cache|PGRST202|not found|404)/i.test(msg);
}

/**
 * รัน migration ตัวเดียวตามชื่อ แล้วบอก PostgREST ให้รีโหลด schema
 *
 * ใช้ตอนฟีเจอร์ไปเจอคอลัมน์ที่ยังไม่มี (เช่น ใส่รูปคอร์สแล้วยังไม่มี image_url) —
 * จะได้ซ่อมให้เองแล้วลองใหม่ทันที ไม่ต้องให้ร้านไปกดตั้งค่าก่อน
 * คืน true ถ้าคอลัมน์พร้อมใช้ (idempotent — "add column if not exists")
 */
export async function ensureMigration(name: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const m = MIGRATIONS.find((x) => x.name === name);
  if (!m) return false;
  try {
    const { error } = await sb.rpc("exec_sql", { sql: m.sql });
    if (error) return false;
    await sb.rpc("exec_sql", { sql: "notify pgrst, 'reload schema';" }).then(
      () => {},
      () => {}
    );
    return true;
  } catch {
    return false;
  }
}

/** รันทุก migration ผ่าน exec_sql (idempotent — ปลอดภัยรันซ้ำ) */
export async function runMigrations(): Promise<MigrateResult> {
  const sb = getSupabase();
  if (!sb) {
    return {
      ok: false,
      bootstrapNeeded: false,
      applied: [],
      errors: [{ name: "_", error: "ไม่มีการเชื่อม Supabase (โหมด dev/mem)" }],
    };
  }

  const applied: string[] = [];
  const errors: { name: string; error: string }[] = [];

  for (const m of MIGRATIONS) {
    const { error } = await sb.rpc("exec_sql", { sql: m.sql });
    if (error) {
      const msg = error.message || String(error);
      if (looksLikeMissingFunction(msg)) {
        return { ok: false, bootstrapNeeded: true, applied, errors };
      }
      errors.push({ name: m.name, error: msg });
    } else {
      applied.push(m.name);
    }
  }

  // ให้ PostgREST รู้จักคอลัมน์ใหม่ทันที
  if (applied.length > 0) {
    await sb.rpc("exec_sql", { sql: "notify pgrst, 'reload schema';" }).then(
      () => {},
      () => {}
    );
  }

  return {
    ok: errors.length === 0,
    bootstrapNeeded: false,
    applied,
    errors,
  };
}
