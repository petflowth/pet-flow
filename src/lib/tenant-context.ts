import { AsyncLocalStorage } from "node:async_hooks";
import { getBootstrapTenantId } from "./auth";

/**
 * ตัวร้านที่กำลังประมวลผลอยู่ตอนนี้ — เซ็ตครั้งเดียวตอนเข้า API route
 * แล้ว store function ทุกตัวดึงได้โดยไม่ต้องส่ง tenantId เป็นพารามิเตอร์ทุกฟังก์ชัน
 *
 * สำคัญ: ต้องเรียกผ่าน withTenant()/withBootstrapTenant() เท่านั้น ห้าม query DB
 * ที่ต้องกรองด้วย tenant_id โดยไม่ผ่านทั้งสองนี้ก่อน ไม่งั้นข้อมูลข้ามร้านได้
 */
const storage = new AsyncLocalStorage<string>();

/**
 * เรียกจาก store function เพื่อเอา tenant_id ปัจจุบันไปกรอง query
 *
 * ถ้า route ที่เรียกมายังไม่ได้ wrap ด้วย withTenant()/withBootstrapTenant()
 * (ยังมีอีกหลายไฟล์ที่ทยอยแปลงอยู่ — ดู T3) จะ fallback ไปใช้ร้าน bootstrap
 * แทนการพัง — ปลอดภัยตอนนี้เพราะมีร้านเดียว แต่ต้องรัดให้ throw แทนทันทีที่ทุก
 * route ห่อ context ครบแล้ว ไม่งั้นบั๊กจะเงียบเมื่อมีร้านที่ 2
 */
export function requireTenantId(): string {
  const id = storage.getStore() || getBootstrapTenantId();
  if (!id) {
    throw new Error(
      "ไม่มี tenant context และไม่มี TENANT_ID — ตั้งค่า TENANT_ID ใน env หรือ wrap route ด้วย withTenant()"
    );
  }
  return id;
}

/** ใช้ใน API route หลังบ้านที่ล็อกอินแล้ว (มี session.tenantId) */
export function withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return storage.run(tenantId, fn);
}

/**
 * ใช้ใน API route ฝั่งลูกค้า (LIFF) ที่ยังไม่มี session หลังบ้าน — bootstrap เดียว
 * ตอนนี้มีร้านเดียว (CatCha) จึงอ่านจาก env TENANT_ID ได้เลย
 * พอมีหลายร้านจริง ต้องเปลี่ยนไป resolve จาก LIFF ID/domain แทน (ดู T5)
 */
export function withBootstrapTenant<T>(fn: () => Promise<T>): Promise<T> {
  const tenantId = getBootstrapTenantId();
  if (!tenantId) {
    throw new Error("ยังไม่ได้ตั้งค่า TENANT_ID — ดูขั้นตอนใน SETUP_NEW_SHOP.md");
  }
  return storage.run(tenantId, fn);
}
