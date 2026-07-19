"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/Toast";
import { relevantAutoMessageTopics } from "@/lib/auto-messages";

/**
 * ปุ่มส่งหาลูกค้าแบบรวมศูนย์ — ใช้ได้ทุกที่ (การ์ดในปฏิทิน · บิล · ฯลฯ)
 * ปุ่มไหนโผล่ขึ้นกับ context ที่มี (booking / invoice / customer)
 * booking-based → /api/bookings · invoice/มัดจำ → /api/invoices
 */
export function CustomerSendButtons({
  lineUserId,
  customerId,
  bookingId,
  invoiceId,
  service,
  invoiceDeposit = 0,
  invoiceStatus,
  groomBookingIds,
  initialAutoOff,
  onDone,
}: {
  lineUserId?: string;
  customerId?: string;
  bookingId?: string;
  invoiceId?: string;
  service?: "room" | "groom" | "both";
  invoiceDeposit?: number;
  /** สถานะบิลที่ส่งมาจากหน้าบิล — ใช้ล็อกไม่ให้ส่งใบเสร็จตอนยังไม่จ่าย */
  invoiceStatus?: string;
  /** ถ้านัดนี้เป็นการ์ดรวมหลายตัว (จองทั้งบ้าน) — bookingId ของทุกตัว เอาไว้ส่งการ์ดสอบถามประวัติแยกให้ครบทุกตัว */
  groomBookingIds?: string[];
  /** หัวข้อข้อความอัตโนมัติที่นัดนี้ปิดไว้แล้ว (ถ้ามี) — ให้ปุ่มเปิด/ปิดตรงนี้เริ่มตรงกับของจริง */
  initialAutoOff?: string[];
  onDone?: () => void;
}) {
  const [busy, setBusy] = useState("");
  const noLine = !lineUserId;

  // ถ้ามาจากการ์ดนัด (มี bookingId แต่ไม่มี invoiceId) → ไปหาบิลที่ผูกกับนัดนั้นเอง
  const [foundInvoiceId, setFoundInvoiceId] = useState<string | undefined>();
  const [foundDeposit, setFoundDeposit] = useState(0);
  const [foundStatus, setFoundStatus] = useState<string | undefined>();
  useEffect(() => {
    if (invoiceId || !bookingId) return;
    let alive = true;
    fetch(`/api/invoices?bookingId=${bookingId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d.invoice) return;
        setFoundInvoiceId(d.invoice.id);
        setFoundDeposit(d.invoice.deposit || 0);
        setFoundStatus(d.invoice.status);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [invoiceId, bookingId]);

  const invId = invoiceId || foundInvoiceId;
  const depForBill = invoiceId ? invoiceDeposit : foundDeposit;
  const billPaid = (invoiceId ? invoiceStatus : foundStatus) === "paid";

  const call = async (key: string, run: () => Promise<Response>, okMsg: string) => {
    setBusy(key);
    try {
      const res = await run();
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast(okMsg, "success");
        onDone?.();
      } else {
        toast(d.error ? `ส่งไม่สำเร็จ: ${d.error}` : "ส่งไม่สำเร็จ — ตรวจ LINE / ตั้งค่า", "error");
      }
    } finally {
      setBusy("");
    }
  };

  const bookingSend = (action: string, okMsg: string) =>
    call(
      action,
      () =>
        fetch("/api/bookings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: bookingId, action, lineUserId }),
        }),
      okMsg
    );

  // นัดที่จองทั้งบ้าน (หลายตัวพร้อมกัน) — ส่งการ์ดเดียว ลิงก์เดียว ให้กรอกประวัติครบทุกตัวในหน้าเดียวกัน
  const sendGroomInfoAll = async () => {
    const ids =
      groomBookingIds && groomBookingIds.length > 0
        ? groomBookingIds
        : bookingId
          ? [bookingId]
          : [];
    if (ids.length === 0) return;
    setBusy("send_groom_info");
    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ids[0],
          action: "send_groom_info_group",
          ids,
          lineUserId,
        }),
      });
      if (res.ok) {
        toast(
          ids.length > 1 ? `ส่งการ์ดสอบถามประวัติแล้ว (${ids.length} ตัว) 🩺` : "ส่งการ์ดสอบถามประวัติน้องแล้ว 🩺",
          "success"
        );
        onDone?.();
      } else {
        const d = await res.json().catch(() => ({}));
        toast(d.error ? `ส่งไม่สำเร็จ: ${d.error}` : "ส่งไม่สำเร็จ — ตรวจ LINE / ตั้งค่า", "error");
      }
    } finally {
      setBusy("");
    }
  };

  const invoiceSummary = (mode: string, okMsg: string) =>
    call(
      "inv:" + mode,
      () =>
        fetch("/api/invoices", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: invId, action: "send_summary", mode }),
        }),
      okMsg
    );

  const sendReview = () =>
    call(
      "inv:review",
      () =>
        fetch("/api/invoices", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: invId, action: "send_review" }),
        }),
      "ส่งการ์ดขอรีวิวแล้ว ⭐"
    );

  const depositRequest = () => {
    // ถ้าบิลมีมัดจำอยู่แล้ว → เคยเรียกเก็บไปแล้ว กันส่งซ้ำโดยไม่ตั้งใจ ต้องกดยืนยันอีกที
    if (depForBill > 0) {
      const ok = confirm(
        `เรียกเก็บมัดจำนัดนี้ไปแล้ว ${depForBill.toLocaleString()} บาท — ต้องการส่งการ์ดซ้ำอีกครั้งไหม?`
      );
      if (!ok) return;
    }
    let amount = depForBill > 0 ? depForBill : 0;
    if (amount <= 0) {
      const raw = prompt("เรียกเก็บมัดจำเท่าไหร่? (บาท)");
      if (raw == null) return;
      amount = Math.round(Number(raw) || 0);
    }
    if (amount <= 0) {
      toast("ใส่จำนวนมัดจำ", "error");
      return;
    }
    // เซิร์ฟเวอร์จะผูกมัดจำให้เอง — มีบิลอยู่แล้วก็ผูกเข้าบิลนั้น
    // ไม่มีบิลก็พักไว้เป็นเครดิตมัดจำล่วงหน้า หักอัตโนมัติตอนออกบิลถัดไป
    void call(
      "dep",
      () =>
        fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "send_deposit_request",
            customerId,
            amount,
            invoiceId: invId,
          }),
        }),
      invId
        ? `ส่งการ์ดเรียกเก็บมัดจำ ${amount.toLocaleString()} บาทแล้ว 📨 (ผูกกับบิลนี้แล้ว)`
        : `ส่งการ์ดเรียกเก็บมัดจำ ${amount.toLocaleString()} บาทแล้ว 📨 (จะหักเข้าบิลถัดไปให้อัตโนมัติ)`
    );
  };

  // 🔕 ปิดข้อความอัตโนมัติเฉพาะนัดนี้ — แก้ได้จากทุกที่ที่มีปุ่มส่ง LINE
  // (เดิมแก้ได้แค่ในหน้าแก้ไขนัดที่ ตารางนัด ย้ายมาไว้ตรงนี้ด้วยจะได้แก้จากหน้าคิดเงินได้เลย)
  const [autoOffOpen, setAutoOffOpen] = useState(false);
  const [autoOff, setAutoOff] = useState<string[]>(initialAutoOff || []);
  const [autoOffSaving, setAutoOffSaving] = useState(false);
  useEffect(() => {
    setAutoOff(initialAutoOff || []);
  }, [initialAutoOff]);
  const toggleAutoOff = async (topic: string) => {
    if (!bookingId) return;
    const next = autoOff.includes(topic)
      ? autoOff.filter((x) => x !== topic)
      : [...autoOff, topic];
    setAutoOff(next);
    setAutoOffSaving(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bookingId, action: "update", autoOff: next }),
      });
      if (res.ok) {
        toast(
          next.includes(topic) ? "ปิดข้อความหัวข้อนี้แล้ว 🔕" : "เปิดกลับมาส่งตามปกติแล้ว",
          "success"
        );
        onDone?.();
      } else {
        setAutoOff(autoOff); // ย้อนกลับถ้าบันทึกไม่สำเร็จ
        toast("บันทึกไม่สำเร็จ", "error");
      }
    } finally {
      setAutoOffSaving(false);
    }
  };

  // 📦 ชุดการ์ด — เลือกหลายใบ ส่งใน push เดียว (LINE นับ 1 ข้อความ)
  const [bundleOpen, setBundleOpen] = useState(false);
  const [bundleParts, setBundleParts] = useState<string[]>([]);
  // LINE ส่งได้สูงสุด 5 การ์ดต่อ 1 ข้อความ — กันเลือกเกินแล้วโดนตัดทิ้งเงียบๆ
  const BUNDLE_MAX = 5;
  const toggleBundlePart = (p: string) =>
    setBundleParts((prev) => {
      if (prev.includes(p)) return prev.filter((x) => x !== p);
      if (prev.length >= BUNDLE_MAX) {
        toast(`เลือกได้สูงสุด ${BUNDLE_MAX} การ์ดต่อ 1 ข้อความ`, "error");
        return prev;
      }
      return [...prev, p];
    });

  /** ส่งการ์ดชุดใดก็ได้ผ่าน endpoint เดียว — ใช้ทั้งตัวเลือกชุดการ์ดและปุ่มเดี่ยวบางปุ่ม */
  const sendBundleParts = async (
    parts: string[],
    okMsg: string,
    busyKey = "bundle:receipt",
    depositAmount?: number
  ) => {
    if (!bookingId || parts.length === 0) return;
    setBusy(busyKey);
    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: bookingId,
          action: "send_bundle",
          parts,
          depositAmount: depositAmount || undefined,
          lineUserId,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        // ระบบข้ามการ์ดบางใบให้ (เช่น เคยกรอกประวัติแล้ว) — ต้องบอกให้รู้ ไม่ใช่เงียบ
        const note = d.skipped?.length ? ` · ข้ามให้: ${d.skipped.join(", ")}` : "";
        toast(okMsg + note, "success");
        onDone?.();
        return true;
      }
      toast(d.error ? `ส่งไม่สำเร็จ: ${d.error}` : "ส่งไม่สำเร็จ", "error");
      return false;
    } finally {
      setBusy("");
    }
  };

  const sendBundle = async () => {
    if (!bookingId || bundleParts.length === 0) return;
    let depositAmount = 0;
    if (bundleParts.includes("deposit")) {
      const raw = prompt(
        "เรียกเก็บมัดจำเท่าไหร่? (บาท)",
        depForBill > 0 ? String(depForBill) : ""
      );
      if (raw == null) return;
      depositAmount = Math.round(Number(raw) || 0);
      if (depositAmount <= 0) {
        toast("ใส่จำนวนมัดจำ", "error");
        return;
      }
    }
    setBusy("bundle");
    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: bookingId,
          action: "send_bundle",
          parts: bundleParts,
          depositAmount: depositAmount || undefined,
          lineUserId,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast(
          `ส่งชุดการ์ด ${d.sent} ใบใน 1 ข้อความแล้ว 📦` +
            (d.skipped?.length ? ` · ข้ามให้: ${d.skipped.join(", ")}` : ""),
          "success"
        );
        setBundleOpen(false);
        setBundleParts([]);
        onDone?.();
      } else {
        toast(d.error ? `ส่งไม่สำเร็จ: ${d.error}` : "ส่งไม่สำเร็จ", "error");
      }
    } finally {
      setBusy("");
    }
  };

  const hasRemaining = depForBill > 0;

  // ครบทุกหัวข้อเท่ากับปุ่มเดี่ยวด้านบน — เลือกผสมได้อิสระ ส่งใน 1 ข้อความ
  const BUNDLE_OPTIONS: { key: string; label: string; when: boolean }[] = [
    { key: "reminder", label: "📨 แจ้งเตือนนัด", when: !!bookingId },
    { key: "prestay", label: "🏠 แจ้งเข้าพัก + เงื่อนไข", when: service === "room" },
    { key: "consent", label: "📋 เงื่อนไข + ลายเซ็น", when: service === "room" },
    {
      // เข้าพักก็ขอประวัติได้ — เคสพักพร้อมอาบน้ำ หรือมาเพิ่มอาบน้ำระหว่างเข้าพัก
      key: "groomInfo",
      label: "🩺 ขอประวัติก่อนอาบน้ำ",
      when: !!bookingId,
    },
    { key: "checkin", label: "🧳 เลือกเวลาเช็คอิน", when: service === "room" },
    { key: "checkout", label: "🧳 เลือกเวลาเช็คเอาท์", when: service === "room" },
    { key: "deposit", label: "💰 เรียกเก็บมัดจำ", when: true },
    {
      key: "depositThanks",
      label: "💚 ยืนยันรับมัดจำแล้ว",
      when: !!invId && hasRemaining,
    },
    { key: "summary", label: "🧾 สรุปการจอง", when: !!invId },
    {
      key: "payment",
      label: hasRemaining ? "💳 เก็บส่วนที่เหลือ" : "💳 แจ้งเก็บเงิน",
      when: !!invId && !billPaid,
    },
    // ใบเสร็จส่งได้เฉพาะบิลที่จ่ายแล้ว — กันส่งใบเสร็จของบิลที่ยังไม่ได้เงิน
    { key: "receipt", label: "🧾 ใบเสร็จ", when: !!invId && billPaid },
    { key: "review", label: "⭐ ขอรีวิว", when: !!invId },
  ];

  const Btn = ({ k, label, onClick }: { k: string; label: string; onClick: () => void }) => (
    <button
      type="button"
      disabled={noLine || busy !== ""}
      onClick={onClick}
      className="rounded-full bg-[#06C755]/15 px-2.5 py-1 text-[10px] font-bold text-[#06883c] disabled:opacity-40"
    >
      {busy === k ? "กำลังส่ง…" : label}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-bold text-brown-faint">
        ส่ง LINE:{noLine ? " (ยังไม่ผูก LINE)" : ""}
      </span>

      {bookingId && (
        <Btn
          k="send_reminder"
          label="📨 แจ้งเตือนนัด"
          onClick={() => bookingSend("send_reminder", "ส่งแจ้งเตือนนัดแล้ว 📨")}
        />
      )}
      {bookingId && service === "room" && (
        <Btn
          k="send_prestay"
          label="🏠 แจ้งเข้าพัก + เงื่อนไข"
          onClick={() => bookingSend("send_prestay", "ส่งการ์ดแจ้งเข้าพัก + เงื่อนไขแล้ว 🏠")}
        />
      )}
      {/* เข้าพักก็กดขอประวัติได้ — เคสพักพร้อมอาบน้ำ / มาเพิ่มอาบน้ำระหว่างเข้าพัก */}
      {bookingId && (
        <Btn
          k="send_groom_info"
          label={
            groomBookingIds && groomBookingIds.length > 1
              ? `🩺 สอบถามประวัติก่อนอาบน้ำ (${groomBookingIds.length} ตัว)`
              : "🩺 สอบถามประวัติก่อนอาบน้ำ"
          }
          onClick={sendGroomInfoAll}
        />
      )}
      {bookingId && service === "room" && (
        <Btn
          k="send_checkin_reminder"
          label="🧳 เตือนเช็คอิน + เลือกเวลา"
          onClick={() =>
            bookingSend("send_checkin_reminder", "ส่งการ์ดเลือกเวลาเช็คอินแล้ว 🧳")
          }
        />
      )}
      {bookingId && service === "room" && (
        <Btn
          k="send_checkout_reminder"
          label="🧳 เตือนเช็คเอาท์ + เลือกเวลา"
          onClick={() =>
            bookingSend("send_checkout_reminder", "ส่งการ์ดเลือกเวลาเช็คเอาท์แล้ว 🧳")
          }
        />
      )}

      {customerId && (
        <Btn
          k="dep"
          label={
            depForBill > 0
              ? `💰 ขอมัดจำแล้ว (${depForBill.toLocaleString()}฿)`
              : "💰 เรียกเก็บมัดจำ"
          }
          onClick={depositRequest}
        />
      )}

      {invId && (
        <Btn
          k="inv:booking"
          label="🧾 สรุปการจอง"
          onClick={() => invoiceSummary("booking", "ส่งสรุปการจองแล้ว 🧾")}
        />
      )}
      {/* จ่ายจบแล้วไม่ต้องทวงเงินอีก — สลับเป็นปุ่มส่งใบเสร็จซ้ำแทน */}
      {invId && billPaid && bookingId && (
        <Btn
          k="bundle:receipt"
          label="🧾 ส่งใบเสร็จอีกครั้ง"
          onClick={() => sendBundleParts(["receipt"], "ส่งใบเสร็จแล้ว 🧾")}
        />
      )}
      {invId && !billPaid && (
        <Btn
          k={hasRemaining ? "inv:remaining" : "inv:full"}
          label={hasRemaining ? "💳 เก็บส่วนที่เหลือ" : "💳 แจ้งเก็บเงิน"}
          onClick={() =>
            invoiceSummary(
              hasRemaining ? "remaining" : "full",
              hasRemaining ? "ส่งแจ้งเก็บส่วนที่เหลือแล้ว 💳" : "ส่งแจ้งเก็บเงินแล้ว 💳"
            )
          }
        />
      )}
      {/* ยอดคงเหลือจากนัด — ใช้เมื่อยังไม่มีบิลผูก (มีบิลแล้วใช้ปุ่มด้านบนแทน) */}
      {bookingId && !invId && (
        <Btn
          k="send_deposit_reminder"
          label="💰 ยอดคงเหลือ"
          onClick={() => bookingSend("send_deposit_reminder", "ส่งแจ้งยอดคงเหลือแล้ว 💰")}
        />
      )}
      {invId && <Btn k="inv:review" label="⭐ ขอรีวิว" onClick={sendReview} />}

      {/* 📦 ชุดการ์ด — รวมหลายใบส่งครั้งเดียว */}
      {bookingId && (
        <button
          type="button"
          disabled={noLine || busy !== ""}
          onClick={() => setBundleOpen((v) => !v)}
          className="rounded-full bg-latte/40 px-2.5 py-1 text-[10px] font-extrabold text-petflow-chocolate disabled:opacity-40"
        >
          📦 ส่งชุดการ์ด {bundleOpen ? "▲" : "▼"}
        </button>
      )}
      {bundleOpen && bookingId && (
        <div className="w-full rounded-petflow-sm border border-latte/50 bg-card p-2.5">
          <p className="mb-1.5 text-[10px] font-bold text-brown-soft">
            เลือกการ์ดที่จะส่งพร้อมกัน ({bundleParts.length}/{BUNDLE_MAX}) —
            ทั้งหมดรวมเป็น <b>1 ข้อความ LINE</b> ตัดโควตาแค่ครั้งเดียว:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {BUNDLE_OPTIONS.filter((o) => o.when).map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => toggleBundlePart(o.key)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  bundleParts.includes(o.key)
                    ? "bg-latte-deep text-white"
                    : "bg-paper text-brown-soft"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={bundleParts.length === 0 || busy !== ""}
            onClick={sendBundle}
            className="mt-2 w-full rounded-petflow-sm bg-latte-deep py-2 text-[11px] font-extrabold text-white disabled:opacity-40"
          >
            {busy === "bundle"
              ? "กำลังส่ง…"
              : `📦 ส่ง ${bundleParts.length} การ์ดใน 1 ข้อความ`}
          </button>
        </div>
      )}

      {/* 🔕 ปิดข้อความอัตโนมัติเฉพาะนัดนี้ — แก้ตรงนี้ได้เลย ไม่ต้องไปเปิดหน้าแก้ไขนัด */}
      {bookingId && (
        <button
          type="button"
          onClick={() => setAutoOffOpen((v) => !v)}
          className="rounded-full bg-wait/15 px-2.5 py-1 text-[10px] font-extrabold text-wait"
        >
          🔕 ปิดข้อความอัตโนมัติ{autoOff.length > 0 ? ` (${autoOff.length})` : ""}{" "}
          {autoOffOpen ? "▲" : "▼"}
        </button>
      )}
      {autoOffOpen && bookingId && (
        <div className="w-full rounded-catcha-sm border border-wait/30 bg-card p-2.5">
          <p className="mb-1.5 text-[10px] font-bold text-brown-soft">
            ติ๊กหัวข้อที่ไม่อยากให้ระบบส่งอัตโนมัติหานัดนี้ (นัดอื่นไม่กระทบ):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {relevantAutoMessageTopics(service).map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={autoOffSaving}
                onClick={() => toggleAutoOff(t.id)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold disabled:opacity-40 ${
                  autoOff.includes(t.id)
                    ? "bg-wait text-white"
                    : "bg-paper text-brown-soft"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
