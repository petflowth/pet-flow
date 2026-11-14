"use client";

/**
 * ชิ้นส่วนหน้าจอระบบร้านทำผม — ออกแบบให้ผู้สูงอายุใช้ได้
 * ตัวหนังสือใหญ่ (20px ขึ้นไป) ปุ่มสูงอย่างน้อย 64px สีตัดกันชัด คำไทยล้วน ไม่ใช้ไอคอนอย่างเดียว
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { SalonSettings, Service } from "@/lib/salon/shared";

// ───────────── เรียก API

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
  }
}

export async function api<T = Record<string, unknown>>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method || (init?.body ? "POST" : "GET"),
      headers: init?.body ? { "content-type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("อินเทอร์เน็ตหลุด ลองใหม่อีกครั้ง", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    const prefix = shopPrefix(window.location.pathname);
    window.location.href = `${prefix}/admin/login?next=${encodeURIComponent(window.location.pathname)}`;
    throw new ApiError("ต้องเข้าสู่ระบบก่อน", 401);
  }
  if (!res.ok || data.error) throw new ApiError(data.error || "ระบบขัดข้อง ลองใหม่", res.status, data.code);
  return data as T;
}

// ───────────── ลิงก์ (รองรับ /s/<ร้าน>/salon)

function shopPrefix(pathname: string): string {
  const m = pathname.match(/^\/s\/[^/]+/);
  return m ? m[0] : "";
}

export function useHref() {
  const pathname = usePathname() || "";
  const prefix = shopPrefix(pathname);
  return useCallback((p: string) => `${prefix}${p}`, [prefix]);
}

// ───────────── ข้อมูลร้าน (โหลดครั้งเดียวทุกหน้า)

export type Boot = {
  settings: SalonSettings;
  services: Service[];
  isOwner: boolean;
  name: string;
  today: string;
};

const BootCtx = createContext<{ boot: Boot | null; reload: () => Promise<void>; error: string }>({
  boot: null,
  reload: async () => {},
  error: "",
});

export function BootProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      setBoot(await api<Boot>("/api/salon/boot"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return <BootCtx.Provider value={{ boot, reload, error }}>{children}</BootCtx.Provider>;
}

export const useBoot = () => useContext(BootCtx);

// ───────────── ปุ่ม

type Tone = "primary" | "green" | "plain" | "danger" | "soft";
const TONE: Record<Tone, string> = {
  primary: "bg-[#1f4e8c] text-white active:bg-[#173b6a]",
  green: "bg-[#1d7a46] text-white active:bg-[#155c35]",
  danger: "bg-white text-[#b42318] border-2 border-[#b42318] active:bg-[#fdecea]",
  plain: "bg-white text-[#1a1a1a] border-2 border-[#9aa3ae] active:bg-[#eef1f4]",
  soft: "bg-[#e8eef7] text-[#1f4e8c] active:bg-[#d6e1f1]",
};

export function Btn({
  children,
  onClick,
  tone = "primary",
  href,
  disabled,
  big,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: Tone;
  href?: string;
  disabled?: boolean;
  big?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const cls = `flex w-full items-center justify-center gap-2 rounded-2xl px-4 text-center font-bold transition select-none ${
    big ? "min-h-[80px] text-[26px]" : "min-h-[64px] text-[21px]"
  } ${disabled ? "bg-[#d5d9de] text-[#6b7280] border-0" : TONE[tone]} ${className}`;
  if (href && !disabled) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

// ───────────── กล่อง หัวข้อ ช่องกรอก

export function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border-2 border-[#d5d9de] bg-white p-4 ${onClick ? "cursor-pointer active:bg-[#f3f5f7]" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function Title({ children, back }: { children: ReactNode; back?: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      {back && (
        <Link
          href={back}
          className="flex min-h-[56px] min-w-[96px] items-center justify-center rounded-2xl border-2 border-[#9aa3ae] bg-white px-3 text-[20px] font-bold"
        >
          ‹ กลับ
        </Link>
      )}
      <h1 className="text-[28px] font-extrabold leading-tight">{children}</h1>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
  multiline,
  autoFocus,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "numeric" | "decimal" | "tel" | "text" | "search";
  multiline?: boolean;
  autoFocus?: boolean;
}) {
  const cls =
    "mt-1 w-full rounded-2xl border-2 border-[#9aa3ae] bg-white px-4 text-[22px] outline-none focus:border-[#1f4e8c] focus:ring-4 focus:ring-[#1f4e8c]/20";
  return (
    <label className="block">
      <span className="text-[20px] font-bold">{label}</span>
      {multiline ? (
        <textarea
          className={`${cls} min-h-[110px] py-3`}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={`${cls} h-[64px]`}
          type={type}
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

/** สวิตช์ เปิด/ปิด ตัวใหญ่ มีคำบอกสถานะ */
export function Toggle({ label, on, onChange, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex min-h-[72px] w-full items-center justify-between gap-3 rounded-2xl border-2 border-[#d5d9de] bg-white px-4 py-2 text-left"
    >
      <span>
        <span className="block text-[21px] font-bold">{label}</span>
        {hint && <span className="block text-[17px] text-[#4b5563]">{hint}</span>}
      </span>
      <span
        className={`shrink-0 rounded-full px-4 py-2 text-[20px] font-extrabold ${on ? "bg-[#1d7a46] text-white" : "bg-[#d5d9de] text-[#374151]"}`}
      >
        {on ? "เปิด" : "ปิด"}
      </span>
    </button>
  );
}

export function ErrorBox({ text }: { text: string }) {
  if (!text) return null;
  return <div className="my-3 rounded-2xl border-2 border-[#b42318] bg-[#fdecea] p-4 text-[21px] font-bold text-[#b42318]">{text}</div>;
}

export function Loading() {
  return <div className="py-16 text-center text-[22px] text-[#4b5563]">กำลังโหลด…</div>;
}

/** หน้าต่างเด้งเต็มจอด้านล่าง */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-[#f6f7f9] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[26px] font-extrabold">{title}</h2>
          <button
            onClick={onClose}
            className="min-h-[56px] rounded-2xl border-2 border-[#9aa3ae] bg-white px-4 text-[20px] font-bold"
          >
            ปิด ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** ตัวเลขเงินตัวโต */
export function Money({ value, className = "" }: { value: number; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{(Number(value) || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ฿</span>;
}

export function newKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
