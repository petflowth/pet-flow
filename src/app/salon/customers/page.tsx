"use client";

import { useEffect, useState } from "react";
import type { Customer } from "@/lib/salon/shared";
import { api, Btn, Card, Field, Loading, Sheet, Title, useHref, ErrorBox } from "@/components/salon/ui";
import { useRouter } from "next/navigation";

export default function CustomersPage() {
  const href = useHref();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [list, setList] = useState<Customer[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      api<{ customers: Customer[] }>(`/api/salon/customers?q=${encodeURIComponent(q)}`)
        .then((r) => setList(r.customers))
        .catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const add = async () => {
    try {
      const r = await api<{ customer: Customer }>("/api/salon/customers", { body: { name, phone } });
      router.push(href(`/salon/customers/${r.customer.id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <Title>ลูกค้า</Title>
      <Field label="ค้นหาชื่อ หรือ เบอร์โทร" value={q} onChange={setQ} inputMode="search" />
      <Btn tone="primary" onClick={() => setAdding(true)}>
        + เพิ่มลูกค้าใหม่
      </Btn>
      <ErrorBox text={error} />
      {list === null ? (
        <Loading />
      ) : list.length === 0 ? (
        <div className="py-6 text-center text-[21px] text-[#4b5563]">ไม่พบลูกค้า</div>
      ) : (
        <div className="space-y-2">
          {!q && <div className="text-[19px] text-[#4b5563]">ลูกค้าล่าสุด</div>}
          {list.map((c) => (
            <Card key={c.id} onClick={() => router.push(href(`/salon/customers/${c.id}`))}>
              <div className="text-[23px] font-bold">
                {c.name}
                {c.nickname ? ` (${c.nickname})` : ""}
              </div>
              <div className="text-[19px] text-[#374151]">{c.phone || "ไม่มีเบอร์"}</div>
            </Card>
          ))}
        </div>
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title="ลูกค้าใหม่">
        <div className="space-y-3">
          <Field label="ชื่อ" value={name} onChange={setName} autoFocus />
          <Field label="เบอร์โทร" value={phone} onChange={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))} inputMode="tel" />
          <Btn tone="green" disabled={!name.trim()} onClick={add}>
            บันทึก
          </Btn>
        </div>
      </Sheet>
    </div>
  );
}
