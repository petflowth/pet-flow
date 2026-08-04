"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/Toast";

type Row = {
  id: string;
  customerId: string;
  customerName: string;
  kind: "owner" | "cat";
  catName?: string;
  forDate: string;
  text: string;
};

export default function BirthdaysPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/birthdays")
      .then((r) => r.json())
      .then((d) => {
        const list: Row[] = d.rows || [];
        setRows(list);
        setSelected(new Set(list.map((r) => r.id)));
      })
      .catch(() => {
        setRows([]);
        setSelected(new Set());
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sendSelected = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/birthdays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", ids: Array.from(selected) }),
      });
      const d = await res.json();
      if (res.ok) {
        toast(
          `ส่งแล้ว ${d.sent} ใบ${d.coupons ? ` · แจกคูปอง ${d.coupons} ใบ` : ""}${
            d.errors?.length ? ` (พลาด ${d.errors.length})` : ""
          }`,
          d.errors?.length ? "error" : "success"
        );
        load();
      } else {
        toast(d.error || "ส่งไม่สำเร็จ", "error");
      }
    } catch {
      toast("เชื่อมต่อไม่สำเร็จ", "error");
    }
    setBusy(false);
  };

  const dismiss = async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    try {
      await fetch("/api/admin/birthdays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", id }),
      });
    } catch {
      toast("ข้ามไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
      load();
    }
  };

  if (loading) {
    return <p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-extrabold text-petflow-chocolate">🎂 วันเกิดลูกค้ารอตรวจ</h1>
        <p className="mt-1 text-xs text-brown-soft">
          ระบบคัดกรองไว้ให้แล้ว แต่ยังไม่ส่ง — ตรวจข้อความแล้วค่อยกดส่ง (คูปองก็แจกตอนกดส่งเท่านั้น)
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-catcha border border-dashed border-petflow-line py-10 text-center">
          <p className="text-sm font-bold text-brown-soft">ไม่มีวันเกิดรอตรวจตอนนี้</p>
          <p className="mt-1 text-xs text-brown-faint">
            ระบบจะคัดกรองให้เองทุกวันตอนเที่ยง แล้วขึ้นให้ตรวจที่นี่
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 rounded-petflow-sm border border-honey-deep/40 bg-honey/10 px-3 py-2.5">
            <p className="text-xs font-bold text-brown">
              เลือกแล้ว {selected.size} / {rows.length} ใบ
            </p>
            <button
              type="button"
              disabled={busy || selected.size === 0}
              onClick={sendSelected}
              className="rounded-petflow-sm bg-gradient-to-r from-honey to-honey-deep px-4 py-2 text-xs font-extrabold text-petflow-chocolate shadow-petflow-sm disabled:opacity-50"
            >
              {busy ? "กำลังส่ง…" : `🎂 ส่งที่เลือก (${selected.size})`}
            </button>
          </div>

          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-petflow-sm border border-petflow-line bg-card px-3 py-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    className="mt-1 h-4 w-4 shrink-0 accent-honey-deep"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-xs font-extrabold text-petflow-chocolate">
                        {r.customerName}
                        {r.kind === "cat" && r.catName ? ` · น้อง${r.catName}` : " · เจ้าของ"}
                      </span>
                      <button
                        type="button"
                        onClick={() => dismiss(r.id)}
                        className="text-[10px] font-bold text-brown-faint underline"
                      >
                        ข้ามวันนี้
                      </button>
                    </div>
                    <p className="mt-1 whitespace-pre-line rounded bg-paper px-2 py-1.5 text-[11px] text-brown">
                      {r.text}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
