-- ═══════════════════════════════════════════════════════════════
-- ล้างเครื่อง DEMO ให้ว่างเปล่า — ใช้ตอนส่งต่อให้ลูกค้าคนถัดไปลอง
-- ═══════════════════════════════════════════════════════════════
--
-- ⚠️  ห้ามรันบนเครื่องของร้านจริง — ข้อมูลหายหมด กู้คืนไม่ได้
--     เช็คให้ชัวร์ว่ากำลังเปิดโปรเจกต์ demo อยู่ ไม่ใช่โปรเจกต์ของร้าน
--
-- วิธีใช้: Supabase → SQL Editor → วางทั้งหมด → Run (ไม่ถึง 1 วินาที)
--
-- ลบทิ้ง:   ลูกค้า แมว นัด บิล รายรับ แต้ม คูปอง คอร์ส โปร บทความ พนักงาน
-- เก็บไว้:  โครงสร้างตาราง + Token ของ LINE/Telegram
--           (จะได้ไม่ต้องตั้ง LINE ใหม่ทุกครั้งที่ส่งต่อ)
--
-- ค่าตั้งค่าร้าน (ชื่อร้าน ที่อยู่ บัญชีธนาคาร ห้องพัก ราคา) จะถูกล้างด้วย
-- ลูกค้าคนถัดไปจะได้กรอกเองตั้งแต่ต้น เหมือนเพิ่งติดตั้งจริง ๆ

begin;

-- ตารางหลัก — ลบพร้อมกันด้วย cascade กัน foreign key ขัดกันเอง
truncate table
  promo_claims,
  points_history,
  points_accounts,
  service_records,
  member_topups,
  finance_records,
  invoices,
  bookings,
  cats,
  customers,
  promos,
  broadcast_images
restart identity cascade;

-- ตารางที่เพิ่มมาทีหลัง — เครื่องที่ยังไม่ได้อัปเดตอาจไม่มี จึงต้องเช็คก่อนลบ
do $$
declare t text;
begin
  foreach t in array array[
    'coupons', 'coupon_offers', 'customer_packages',
    'articles', 'staff_users', 'chat_watch'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('truncate table %I restart identity cascade', t);
    end if;
  end loop;
end $$;

-- ล้างเฉพาะ "ค่าตั้งค่าร้าน" (แถว main)
-- แถว secrets ไม่แตะ — Token LINE/Telegram จะยังอยู่ ไม่ต้องต่อใหม่
delete from site_config where id = 'main';

commit;

-- ── ตรวจผล: ต้องเป็น 0 ทุกบรรทัด ──
select 'customers' as ตาราง, count(*) as เหลือ from customers
union all select 'cats',       count(*) from cats
union all select 'bookings',   count(*) from bookings
union all select 'invoices',   count(*) from invoices
union all select 'finance',    count(*) from finance_records
union all select 'points',     count(*) from points_accounts
union all select 'promos',     count(*) from promos;

-- ── ตรวจว่า Token ยังอยู่: ควรได้ 1 แถว (secrets) ──
select id from site_config;
