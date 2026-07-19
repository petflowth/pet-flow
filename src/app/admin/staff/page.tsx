"use client";

import { useCallback, useEffect, useState } from "react";
import { ADMIN_TABS } from "@/components/AdminNav";

type StaffItem = {
  id: string;
  name: string;
  code: string;
  menus: string[];
  active: boolean;
};

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newMenus, setNewMenus] = useState<string[]>([
    "/admin",
    "/admin/schedule",
    "/admin/bookings/new",
    "/admin/customers",
    "/admin/billing",
  ]);
  const [busy, setBusy] = useState(false);

  const adminCode =
    typeof window !== "undefined" ? sessionStorage.getItem("petflow-admin") || "" : "";

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/staff", {
        headers: { "x-admin-code": adminCode },
      });
      if (res.status === 403) {
        setIsOwner(false);
        setLoaded(true);
        return;
      }
      const d = await res.json();
      setStaff(d.staff || []);
      setIsOwner(true);
    } catch {
      /* เงียบ — โชว์เป็นลิสต์ว่าง */
    }
    setLoaded(true);
  }, [adminCode]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleMenu = (list: string[], href: string) =>
    list.includes(href) ? list.filter((h) => h !== href) : [...list, href];

  const addStaff = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-code": adminCode },
        body: JSON.stringify({ action: "add", name: newName, code: newCode, menus: newMenus }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(`✅ เพิ่ม "${newName}" แล้ว — ให้พนักงานใช้รหัสนี้ล็อกอินได้เลย`);
        setNewName("");
        setNewCode("");
        load();
      } else {
        setMsg(`❌ ${d.error || "เพิ่มไม่สำเร็จ"}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const patchStaff = async (id: string, patch: Record<string, unknown>) => {
    await fetch("/api/admin/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-code": adminCode },
      body: JSON.stringify({ id, ...patch }),
    });
    load();
  };

  const removeStaff = async (s: StaffItem) => {
    if (!confirm(`ลบบัญชีพนักงาน "${s.name}"?`)) return;
    await fetch(`/api/admin/staff?id=${s.id}`, {
      method: "DELETE",
      headers: { "x-admin-code": adminCode },
    });
    load();
  };

  if (!loaded) return null;
  if (!isOwner) {
    return (
      <div className="rounded-petflow bg-card p-4 text-xs font-bold text-brown-soft shadow-petflow-sm">
        เฉพาะเจ้าของร้านเท่านั้นที่จัดการบัญชีพนักงานได้
      </div>
    );
  }

  const menuPicker = (
    selected: string[],
    onToggle: (href: string) => void
  ) => (
    <div className="grid grid-cols-2 gap-1.5">
      {ADMIN_TABS.map((t) => (
        <label key={t.href} className="flex items-center gap-1.5 text-[11px] text-brown">
          <input
            type="checkbox"
            checked={selected.includes(t.href)}
            onChange={() => onToggle(t.href)}
            className="h-3.5 w-3.5 accent-[#4A7348]"
          />
          {t.icon} {t.label}
        </label>
      ))}
    </div>
  );

  return (
    <div className="space-y-3 rounded-petflow bg-card p-4 shadow-petflow-sm">
      <div className="rounded-petflow-sm border border-latte/50 bg-latte/10 p-3">
        <p className="text-xs font-extrabold text-petflow-chocolate">
          👥 บัญชีพนักงาน ({staff.length})
        </p>
        <p className="mb-2 text-[10px] text-brown-soft">
          สร้างรหัสให้พนักงานแต่ละคน แล้วติ๊กเลือกว่าให้เห็นเมนูไหนบ้าง —
          พนักงานล็อกอินด้วยรหัสของตัวเองที่หน้าเดิม จะเห็นเฉพาะเมนูที่เลือกไว้
        </p>

        {staff.map((s) => (
          <details key={s.id} className="mb-2 rounded-petflow-sm border border-petflow-line bg-card p-2.5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-bold text-brown">
                {s.active ? "🟢" : "⏸️"} {s.name}
                <span className="ml-2 font-normal text-brown-faint">
                  รหัส: {s.code} · เห็น {s.menus.length} เมนู
                </span>
              </span>
              <span className="shrink-0 text-[10px] font-bold text-latte-deep">แก้ไข ▾</span>
            </summary>
            <div className="mt-2 space-y-2 border-t border-petflow-line pt-2">
              {menuPicker(s.menus, (href) =>
                patchStaff(s.id, { menus: toggleMenu(s.menus, href) })
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => patchStaff(s.id, { active: !s.active })}
                  className="rounded-full bg-paper px-3 py-1 text-[10px] font-bold text-brown-soft"
                >
                  {s.active ? "⏸️ พักการใช้งาน" : "▶️ เปิดใช้งาน"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const code = prompt("ตั้งรหัสใหม่ (อย่างน้อย 4 ตัว):", s.code);
                    if (code && code.trim().length >= 4) patchStaff(s.id, { code: code.trim() });
                  }}
                  className="rounded-full bg-paper px-3 py-1 text-[10px] font-bold text-brown-soft"
                >
                  🔑 เปลี่ยนรหัส
                </button>
                <button
                  type="button"
                  onClick={() => removeStaff(s)}
                  className="rounded-full bg-wait/10 px-3 py-1 text-[10px] font-bold text-wait"
                >
                  🗑️ ลบ
                </button>
              </div>
            </div>
          </details>
        ))}

        <div className="mt-3 rounded-petflow-sm border border-dashed border-latte/60 bg-card p-2.5">
          <p className="mb-1.5 text-[11px] font-extrabold text-petflow-chocolate">➕ เพิ่มพนักงานใหม่</p>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ชื่อพนักงาน"
              className="rounded-petflow-sm border border-petflow-line bg-paper px-2.5 py-2 text-xs"
            />
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="รหัสเข้าใช้ (4 ตัวขึ้นไป)"
              className="rounded-petflow-sm border border-petflow-line bg-paper px-2.5 py-2 text-xs"
            />
          </div>
          <p className="mb-1 text-[10px] font-bold text-brown-soft">เมนูที่ให้เห็น:</p>
          {menuPicker(newMenus, (href) => setNewMenus((prev) => toggleMenu(prev, href)))}
          <button
            type="button"
            disabled={busy || !newName.trim() || newCode.trim().length < 4}
            onClick={addStaff}
            className="mt-2 w-full rounded-petflow-sm bg-latte-deep py-2 text-xs font-extrabold text-card disabled:opacity-40"
          >
            {busy ? "กำลังเพิ่ม…" : "➕ เพิ่มพนักงาน"}
          </button>
        </div>

        {msg && <p className="mt-2 text-[11px] font-bold text-brown">{msg}</p>}
      </div>
    </div>
  );
}
