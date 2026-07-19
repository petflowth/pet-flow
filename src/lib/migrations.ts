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
    name: "cats.color",
    sql: "alter table cats add column if not exists color text;",
  },
  {
    // รายชื่อข้อความอัตโนมัติที่ "นัดนี้" ไม่ต้องส่ง (ปิดเป็นรายเคส ไม่ใช่ปิดทั้งร้าน)
    name: "bookings.auto_off",
    sql: "alter table bookings add column if not exists auto_off text[] not null default array[]::text[];",
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
