"use client";

import { useEffect, useMemo, useState } from "react";

type Cat = { name?: string; breed?: string };
type Customer = {
  id: string;
  name: string;
  cats: Cat[];
  isMember?: boolean;
  tier?: string;
  createdAt?: string;
};
type Invoice = {
  customerId?: string;
  customerName: string;
  status: string;
  total: number;
  items?: { label: string; amount: number }[];
};

function Bar({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="text-xs">
      <div className="mb-0.5 flex justify-between">
        <span className="min-w-0 truncate font-bold text-brown">{label}</span>
        <span className="shrink-0 font-extrabold text-latte-deep">
          {value.toLocaleString()}
          {suffix || ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-paper">
        <div className="h-full rounded-full bg-latte-deep/70" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-petflow bg-card p-4 shadow-petflow-sm">
      <h2 className="mb-3 text-sm font-extrabold text-petflow-chocolate">{title}</h2>
      {children}
    </section>
  );
}

export default function InsightsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/invoices").then((r) => r.json()),
    ])
      .then(([c, i]) => {
        setCustomers(c.customers || []);
        setInvoices(i.invoices || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const cats = customers.flatMap((c) => c.cats || []);
    const members = customers.filter((c) => c.isMember).length;

    // พันธุ์แมวยอดฮิต
    const breedMap = new Map<string, number>();
    for (const cat of cats) {
      const b = (cat.breed || "").trim() || "ไม่ระบุ";
      breedMap.set(b, (breedMap.get(b) || 0) + 1);
    }
    const breeds = [...breedMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    // บริการขายดี (จากบิลที่จ่ายแล้ว)
    // ชื่อรายการในบิลมีรูปแบบ "🐱 ชื่อน้อง · บริการ · พันธุ์ · ไซส์"
    // ต้องตัดคำนำหน้าชื่อน้องออกก่อน ไม่งั้นจะไปนับชื่อแมวเป็นชื่อบริการ
    const paid = invoices.filter((i) => i.status === "paid");
    const svcMap = new Map<string, number>();
    for (const inv of paid) {
      for (const it of inv.items || []) {
        if (it.amount <= 0) continue;
        const key =
          (it.label || "")
            .replace(/^🐱\s.+?\s·\s/, "")
            .split(" · ")[0]
            .split(" ×")[0]
            .trim() || "อื่นๆ";
        svcMap.set(key, (svcMap.get(key) || 0) + 1);
      }
    }
    const services = [...svcMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    // ลูกค้าใช้จ่ายสูงสุด
    const spendMap = new Map<string, { name: string; total: number }>();
    for (const inv of paid) {
      const key = inv.customerId || inv.customerName;
      const cur = spendMap.get(key) || { name: inv.customerName, total: 0 };
      cur.total += inv.total;
      spendMap.set(key, cur);
    }
    const topSpenders = [...spendMap.values()].sort((a, b) => b.total - a.total).slice(0, 8);
    const revenuePaid = paid.reduce((s, i) => s + i.total, 0);

    return {
      totalCustomers: customers.length,
      totalCats: cats.length,
      members,
      breeds,
      services,
      topSpenders,
      revenuePaid,
      paidCount: paid.length,
    };
  }, [customers, invoices]);

  if (loading) {
    return <p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;
  }

  const maxBreed = stats.breeds[0]?.[1] || 1;
  const maxSvc = stats.services[0]?.[1] || 1;
  const maxSpend = stats.topSpenders[0]?.total || 1;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-extrabold text-petflow-chocolate">📊 สรุปข้อมูลร้าน</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-petflow-sm bg-card p-4 shadow-petflow-sm">
          <p className="text-lg">👥</p>
          <p className="text-lg font-extrabold text-latte-deep">{stats.totalCustomers}</p>
          <p className="text-xs font-bold text-brown-soft">ลูกค้า · 🐱 {stats.totalCats} แมว</p>
        </div>
        <div className="rounded-petflow-sm bg-card p-4 shadow-petflow-sm">
          <p className="text-lg">💰</p>
          <p className="text-lg font-extrabold text-latte-deep">
            {stats.revenuePaid.toLocaleString()} ฿
          </p>
          <p className="text-xs font-bold text-brown-soft">
            ยอดขายรวม · {stats.paidCount} บิล · 💎 {stats.members} member
          </p>
        </div>
      </div>

      <Card title="🐱 พันธุ์แมวยอดฮิต (ใช้ตัดสินใจทำสินค้า)">
        {stats.breeds.length ? (
          <div className="space-y-2">
            {stats.breeds.map(([b, n]) => (
              <Bar key={b} label={b} value={n} max={maxBreed} suffix=" ตัว" />
            ))}
          </div>
        ) : (
          <p className="text-xs text-brown-faint">ยังไม่มีข้อมูลพันธุ์</p>
        )}
      </Card>

      <Card title="✨ บริการขายดี">
        {stats.services.length ? (
          <div className="space-y-2">
            {stats.services.map(([s, n]) => (
              <Bar key={s} label={s} value={n} max={maxSvc} suffix=" ครั้ง" />
            ))}
          </div>
        ) : (
          <p className="text-xs text-brown-faint">ยังไม่มีบิลที่จ่ายแล้ว</p>
        )}
      </Card>

      <Card title="🏆 ลูกค้าใช้จ่ายสูงสุด">
        {stats.topSpenders.length ? (
          <div className="space-y-2">
            {stats.topSpenders.map((s, i) => (
              <Bar key={i} label={`${i + 1}. ${s.name}`} value={s.total} max={maxSpend} suffix=" ฿" />
            ))}
          </div>
        ) : (
          <p className="text-xs text-brown-faint">ยังไม่มีข้อมูล</p>
        )}
      </Card>

      <p className="text-center text-[10px] text-brown-faint">
        คำนวณจากบิลที่ชำระแล้ว + ข้อมูลลูกค้าในระบบ
      </p>
    </div>
  );
}
