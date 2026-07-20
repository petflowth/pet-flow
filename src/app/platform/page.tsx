"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: "trial" | "active" | "suspended" | "cancelled";
  template: string | null;
  trialEndsAt: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<Tenant["status"], string> = {
  trial: "ทดลองใช้",
  active: "ใช้งานอยู่",
  suspended: "ระงับใช้งาน",
  cancelled: "ยกเลิกแล้ว",
};

const STATUS_COLOR: Record<Tenant["status"], string> = {
  trial: "bg-honey/30 text-latte-deep",
  active: "bg-sage/25 text-ok",
  suspended: "bg-wait/20 text-wait",
  cancelled: "bg-white/10 text-white/50",
};

export default function PlatformDashboard() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/platform/tenants").catch(() => null);
    if (res?.ok) {
      const d = await res.json();
      setTenants(d.tenants || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setMsg("");
    try {
      const res = await fetch("/api/platform/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(`✅ สร้างร้าน "${d.tenant.name}" แล้ว`);
        setName("");
        setSlug("");
        load();
      } else {
        setMsg(`❌ ${d.error || "สร้างไม่สำเร็จ"}`);
      }
    } finally {
      setCreating(false);
    }
  };

  const setStatus = async (id: string, status: Tenant["status"]) => {
    setBusyId(id);
    try {
      await fetch(`/api/platform/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_status", status }),
      });
      load();
    } finally {
      setBusyId("");
    }
  };

  const impersonate = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/platform/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "impersonate" }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) router.push(d.redirect || "/admin");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div>
      <h1 className="mb-1 text-lg font-extrabold">📊 ร้านทั้งหมด</h1>
      <p className="mb-5 text-xs text-white/50">
        จัดการทุกร้านบนแพลตฟอร์มจากที่เดียว — สร้างร้านใหม่, ระงับ/เปิดใช้งาน, เข้าดูแทน
      </p>

      <form
        onSubmit={createTenant}
        className="mb-6 rounded-petflow border border-white/10 bg-[#232637] p-4"
      >
        <p className="mb-3 text-sm font-extrabold">➕ สร้างร้านใหม่</p>
        <div className="mb-2 grid gap-2 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อร้าน"
            className="rounded-petflow-sm border border-white/10 bg-[#1a1d29] px-3 py-2 text-sm text-white outline-none focus:border-latte-deep"
          />
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug (เว้นว่าง = สร้างจากชื่อ)"
            className="rounded-petflow-sm border border-white/10 bg-[#1a1d29] px-3 py-2 text-sm text-white outline-none focus:border-latte-deep"
          />
        </div>
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="w-full rounded-petflow-sm bg-latte-deep py-2.5 text-xs font-extrabold text-white disabled:opacity-40 sm:w-auto sm:px-6"
        >
          {creating ? "กำลังสร้าง…" : "สร้างร้าน"}
        </button>
        {msg && <p className="mt-2 text-xs font-bold text-white/70">{msg}</p>}
      </form>

      {loading ? (
        <p className="text-center text-sm text-white/40">กำลังโหลด…</p>
      ) : tenants.length === 0 ? (
        <p className="rounded-petflow border border-white/10 bg-[#232637] p-6 text-center text-sm text-white/40">
          ยังไม่มีร้านบนแพลตฟอร์ม
        </p>
      ) : (
        <div className="space-y-2">
          {tenants.map((t) => (
            <div
              key={t.id}
              className="rounded-petflow-sm border border-white/10 bg-[#232637] p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-extrabold">
                    {t.name}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[t.status]}`}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                  </p>
                  <p className="text-[10px] text-white/40">
                    /{t.slug} · สร้างเมื่อ {t.createdAt.slice(0, 10)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    onClick={() => impersonate(t.id)}
                    className="rounded-full bg-latte-deep px-3 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-40"
                  >
                    🔑 เข้าดูแทน
                  </button>
                  {t.status !== "suspended" ? (
                    <button
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => setStatus(t.id, "suspended")}
                      className="rounded-full bg-wait/20 px-3 py-1.5 text-[11px] font-bold text-wait disabled:opacity-40"
                    >
                      ⏸️ ระงับ
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => setStatus(t.id, "active")}
                      className="rounded-full bg-sage/20 px-3 py-1.5 text-[11px] font-bold text-ok disabled:opacity-40"
                    >
                      ▶️ เปิดใช้งาน
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
