"use client";

import { useCallback, useEffect, useState } from "react";
import { addDays, thaiDay, type Visit } from "@/lib/salon/shared";
import { api, Btn, Card, ErrorBox, Loading, useBoot, useHref } from "@/components/salon/ui";
import { VisitCard } from "@/components/salon/VisitCard";

/** หน้าแรก: คิววันนี้ + ปุ่มใหญ่ 2 ปุ่ม */
export default function SalonToday() {
  const { boot } = useBoot();
  const href = useHref();
  const [day, setDay] = useState("");
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (boot && !day) setDay(boot.today);
  }, [boot, day]);

  const load = useCallback(async () => {
    if (!day) return;
    try {
      const r = await api<{ visits: Visit[] }>(`/api/salon/visits?day=${day}`);
      setVisits(r.visits);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [day]);

  useEffect(() => {
    setVisits(null);
    load();
    // รีเฟรชเองทุก 1 นาที เผื่อเปิดค้างไว้ทั้งวัน
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (!boot) return <Loading />;
  const isToday = day === boot.today;
  const active = (visits || []).filter((v) => !["cancelled", "no_show"].includes(v.status));
  const other = (visits || []).filter((v) => ["cancelled", "no_show"].includes(v.status));
  const left = active.filter((v) => v.status !== "done").length;

  return (
    <div className="space-y-4">
      {boot.services.length === 0 && (
        <Card className="border-[#1f4e8c] bg-[#e8eef7]">
          <div className="text-[22px] font-bold">เริ่มต้นใช้งาน: ใส่รายการบริการและราคาของร้านก่อน</div>
          <Btn className="mt-3" href={href("/salon/settings")}>
            ไปใส่บริการ
          </Btn>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Btn big tone="green" href={href("/salon/new?type=walkin")}>
          + ลูกค้าเดินเข้า
        </Btn>
        <Btn big tone="primary" href={href(`/salon/new?type=booking&day=${day || boot.today}`)}>
          + จองคิวล่วงหน้า
        </Btn>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setDay(addDays(day, -1))}
          className="min-h-[60px] min-w-[64px] rounded-2xl border-2 border-[#9aa3ae] bg-white text-[26px] font-bold"
          aria-label="วันก่อน"
        >
          ‹
        </button>
        <div className="flex-1 text-center">
          <div className="text-[24px] font-extrabold">{isToday ? "วันนี้" : thaiDay(day)}</div>
          {isToday && <div className="text-[18px] text-[#4b5563]">{thaiDay(day)}</div>}
        </div>
        <button
          onClick={() => setDay(addDays(day, 1))}
          className="min-h-[60px] min-w-[64px] rounded-2xl border-2 border-[#9aa3ae] bg-white text-[26px] font-bold"
          aria-label="วันถัดไป"
        >
          ›
        </button>
      </div>
      {!isToday && (
        <Btn tone="soft" onClick={() => setDay(boot.today)}>
          กลับไปวันนี้
        </Btn>
      )}

      <ErrorBox text={error} />
      {visits === null ? (
        <Loading />
      ) : active.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-[22px] text-[#4b5563]">ยังไม่มีคิว</div>
      ) : (
        <>
          <div className="text-[20px] font-bold text-[#374151]">
            ทั้งหมด {active.length} คิว{left ? ` · ยังไม่เสร็จ ${left}` : ""}
          </div>
          {active.map((v) => (
            <VisitCard key={v.id} v={v} onChanged={load} />
          ))}
        </>
      )}
      {other.length > 0 && (
        <details className="rounded-2xl bg-white p-4">
          <summary className="cursor-pointer text-[20px] font-bold">ยกเลิก / ไม่มา ({other.length})</summary>
          <div className="mt-3 space-y-3">
            {other.map((v) => (
              <VisitCard key={v.id} v={v} onChanged={load} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
