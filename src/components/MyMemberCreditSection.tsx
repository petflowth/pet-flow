"use client";

import { useEffect } from "react";
import { useLiff } from "@/components/LiffProvider";

/**
 * เครดิต Member คงเหลือ — ลูกค้าเติมเงินไว้ล่วงหน้า ต้องเปิดดูยอดตัวเองได้
 * ไม่ได้เป็น Member หรือยอด 0 = ซ่อนทั้งช่อง (ไม่ต้องรกหน้าแรก)
 *
 * ใช้ข้อมูลจาก LiffProvider ที่โหลดมาแล้ว (/api/customers/line ส่ง memberCredit มาอยู่แล้ว)
 * จึงไม่ต้องยิง API เพิ่ม
 *
 * onChecked บอกหน้าแม่ว่ารู้ผลแล้วและมี/ไม่มี — หน้าแรกใช้ตัดสินใจว่าจะโชว์ช่องแต้มไหม
 */
export function MyMemberCreditSection({
  onChecked,
}: {
  onChecked?: (hasCredit: boolean) => void;
}) {
  const { customer, ready } = useLiff();
  const credit = customer?.isMember ? customer.memberCredit || 0 : 0;

  useEffect(() => {
    // รอให้ LIFF โหลดเสร็จก่อนค่อยสรุป กันบอกว่า "ไม่มี" ทั้งที่ยังโหลดไม่เสร็จ
    if (!ready) return;
    onChecked?.(credit > 0);
    // onChecked ตั้งใจไม่ใส่ใน deps — หน้าแม่ส่ง setState มาตรงๆ ใส่แล้วจะวนไม่จบ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, credit]);

  if (credit <= 0) return null;

  return (
    <section className="mb-4 overflow-hidden rounded-petflow bg-gradient-to-br from-latte/35 via-card to-honey/15 p-5 shadow-petflow">
      <p className="text-xs font-bold text-brown-soft">💎 เครดิต Member ของคุณ</p>
      <p className="mt-1 text-4xl font-extrabold text-latte-deep">
        {credit.toLocaleString()}
        <span className="ml-1 text-sm font-bold text-brown-faint">บาท</span>
      </p>
      <p className="mt-1 text-[10px] text-brown-faint">
        ใช้จ่ายค่าบริการได้เลย — แจ้งร้านว่าขอหักจากเครดิตนะคะ 🧡
      </p>
    </section>
  );
}
